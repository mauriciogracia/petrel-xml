import { ProjectReference } from './project-reference';
import { ReferenceType } from "./reference-type";
import { Location, LocationLink, TextDocuments, _, _Connection } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { WorkspaceFolder } from "vscode-languageserver/node";
import globby = require('globby');
import fs = require('fs');
import { fileURLToPath, URL } from 'url';
import DefinitionFinder from './definition-finder';

export class ReferenceManager {
	definitionFinder: DefinitionFinder;
	
	//Keeps referces of definitions and usage/call between XML files
	refs: ProjectReference[] = [];

	//List of files that have been referenced (used to detect folder/file changes: creation, rename, move)
	referencedDocs: string[] = [];
	
	//the current workspace folder
	projectFolder = '';
	
	
	constructor(
		private documents: TextDocuments<TextDocument>,
		connection: _Connection<_, _, _, _, _, _, _>
	)
	{
		this.definitionFinder = new DefinitionFinder(connection, this);
	}

	public getDocument(documentUri: string) : TextDocument {
		return this.documents.get(documentUri)!;
	}

	public async getWorkspaceFilePaths(): Promise<string[]> {
		//get all the XML files of the workspace and convert them to full path
		return (await globby("**/*.xml").catch(err => console.log(`globby error: ${err}`)) || []).map(x => this.toFullPath(x));
	}

	public async checkWorkspaceChanges() {
		const wsFilePaths = await this.getWorkspaceFilePaths();

		//Determine if the referenced docs does not match the xml files in the workspace 
		const obsoleteRefs = this.referencedDocs.filter(rd => wsFilePaths.indexOf(rd) == -1);

		if (obsoleteRefs.length > 0) {
			////DEBUG console.log({ obsoleteRefs: obsoleteRefs });
			obsoleteRefs.forEach(r => this.removeDocumentReferences(r));
		}

		//Determine if new files have not been referenced
		const filesNotReferenced = wsFilePaths.filter(fp => this.referencedDocs.indexOf(fp) == -1);

		if (filesNotReferenced.length > 0) {
			////DEBUG console.log({ filesNotReferenced: filesNotReferenced });
			filesNotReferenced.forEach(r => this.updateDocumentReferences(r));
		}

		
	}

	public toFullPath(relPath: string): string 
	{
		return (this.projectFolder + '/' + relPath);
	}

	public async updateWorkspaceReferences(workspaceFolders: WorkspaceFolder[]) {
		this.projectFolder = workspaceFolders[0].uri;
		console.log(`Updating references for: ${this.projectFolder}`);
		await this.checkWorkspaceChanges();
		console.log(`>>> petrel-xml extension is ready <<<`);
	}

	public getAllDocumentText(docUri: string) {
		let allText: string;

		//If the document is not open (in the documents cache) read it from disk
		if (this.documents.get(docUri) == null)
		{
			const url = new URL(docUri);
			const filePath = fileURLToPath(url);
			try {
				allText = fs.readFileSync(filePath, "utf8");
			}
			catch {
				allText = '';
			}
		}
		else {
			allText = this.documents.get(docUri)!.getText();
		}

		return allText;
	}

	public async updateDocumentReferences(docUri: string) {
		let allText: string;
		let projectReference: ProjectReference | null ;
		let isCommentSection : boolean;
		let singleLineComment : boolean;

		this.removeDocumentReferences(docUri);

		allText = this.getAllDocumentText(docUri);

		if (allText.length > 0) {
			const lines = allText.split(/\r?\n/g);
	
			this.referencedDocs.push(docUri);

			isCommentSection = false ;
			
			lines.forEach((line, i) => {
				projectReference = null ;
				singleLineComment = false ;

				if(this.isSingleLineCommentXML(line))
				{
					singleLineComment = true ; 
				}
				else if (line.includes("<!--"))
				{
					isCommentSection = true ;
				}

				//ignore comments or the parser will complain since we are procesing line by line and block comments will seem open to the parse

				if(	!isCommentSection && !singleLineComment)
				{
					if (this.isDeclarationWithName(line)) {
						projectReference = this.referenceToDeclarationWithName(line,docUri,i+1) ;
					}
					
					else if (this.isIncludeReference(line)) {
						projectReference = this.referenceIncludeBlock(line,docUri, i+1) ;
					}
					else if (line.includes("<action ")) {
						projectReference = this.referenceFromAction(line,docUri, i+1) ;
					}

					if (projectReference != null) {
						this.addProjectReference(projectReference);
					}
				}

				if (this.isEndOfBlockCommentXML(line)) {
					isCommentSection = false ;
				}
			});
		}
	}

	private isSingleLineCommentXML(line:string):boolean {
		return (line.includes("<!--") && line.includes("-->")) ;
	}

	private isEndOfBlockCommentXML(line:string):boolean {
		return (line.includes("-->") && !line.includes("<!--")) ;
	}

	tagsWithNameAttribute = ["<function ", "<rule ", "<group ", "<button ","<set-var ", "<clear-var "];

	private isDeclarationWithName(line:string):boolean {
		return this.tagsWithNameAttribute.some(tag => line.includes(tag));
	}

	tagsRelatedToInclude = ["<include-block ", "<include-block1 ", "<include ", "<include1 "];

	private isIncludeReference(line:string):boolean {
		return this.tagsRelatedToInclude.some(tag => line.includes(tag));
	}

	private addProjectReference(projectReference: ProjectReference) {
		this.refs.push(projectReference);
		console.log(`${projectReference}`);	
	}

	private referenceIncludeBlock(line:string, docUri: string, lineNum: number):ProjectReference | null{
		let projectReference : ProjectReference | null;
		let isDeclaration: boolean;
		let refType : ReferenceType;
		let name: string;

		const jsonXml = this.definitionFinder.parseXML(line) ;

		if(line.includes("<include-block ") || line.includes("<include-block1 "))
		{
			refType = ReferenceType.IncludeBlock ;
			name = this.definitionFinder.getAttributeValueXML("name", jsonXml);
			isDeclaration = true ;
		}
		else 
		{ 
			refType = ReferenceType.Reference ;
			name = this.definitionFinder.getAttributeValueXML("block", jsonXml);
			isDeclaration = false ;
		}

		const createReference = (name); 

		projectReference = null ;

		if (createReference) {
			projectReference = new ProjectReference(refType, name, isDeclaration, docUri, lineNum, this.projectFolder);
		}

		return projectReference ;
	}

	/**
	 * Determine if it's a the type of definition rule/function/group 
	 * 
	 * @param line 
	 * @returns 
	 */
	private determinDeclarationType(line:string) {
		let refType: ReferenceType ;

		if(line.includes("<rule ")) {
			refType = ReferenceType.Rule ;
		}
		else if(line.includes("<function ")) { 
			refType = ReferenceType.Function;
		}
		else if(line.includes("<group ")) { 
			refType = ReferenceType.Group;
		}
		else if(line.includes("<button ")) { 
			refType = ReferenceType.Button;
		}
		else if(line.includes("<set-var ") || line.includes("<clear-var ")) { 
			refType = ReferenceType.Variable;
		}

		return refType! ;
	}

	private referenceToDeclarationWithName(line:string, docUri: string, lineNum: number):ProjectReference | null{
		let projectReference : ProjectReference | null;

		const jsonXml = this.definitionFinder.parseXML(line) ;
		const refType = this.determinDeclarationType(line) ;
		const name = this.definitionFinder.getAttributeValueXML("name", jsonXml);
		const createReference = (name);
		const isDeclaration = true;

		projectReference = null ;

		if (createReference) {
			projectReference = new ProjectReference(refType, name, isDeclaration, docUri, lineNum, this.projectFolder);
		}

		return projectReference ;
	}

	private referenceFromAction(line:string, docUri: string, lineNum: number){
		let projectReference : ProjectReference | null;

		const refType = ReferenceType.Reference;
		let name = '' ;
		
		const jsonXml = this.definitionFinder.parseXML(line) ;

		if(line.includes(" rulename")) {
			name = this.definitionFinder.getAttributeValueXML("rulename", jsonXml);
		}
		else if (line.includes(" function")) {
			name = this.definitionFinder.getAttributeValueXML("function", jsonXml);
		}
		else if (line.includes(" group")) {
			name = this.definitionFinder.getAttributeValueXML("group", jsonXml);
		}
		else if (line.includes(" button")) {
			name = this.definitionFinder.getAttributeValueXML("button", jsonXml);
		}

		const createReference = (name);
		const isDeclaration = false;

		projectReference = null ;

		if (createReference) {
			projectReference = new ProjectReference(refType, name, isDeclaration, docUri, lineNum, this.projectFolder);
		}

		return projectReference ;
	}

	/**
	 * Remove all references to the especified docUri
	 * 
	 * @param docUri 
	 */
	public removeDocumentReferences(docUri: string) {
		let removedRefs;

		removedRefs = 0;

		if (this.refs.some(projectReference => projectReference.fileUri === docUri)) {

			removedRefs = this.refs.length;
			
			this.refs = this.refs.filter(projectReference => projectReference.fileUri !== docUri);

			const index = this.referencedDocs.indexOf(docUri);
			if (index > -1) {
				this.referencedDocs.splice(index, 1);
			}
			removedRefs = removedRefs - this.refs.length;

			console.log(`removedDocumentReferences: ${removedRefs} from file ${docUri}`);
		}

		
	}

	public async getReferences(text: string): Promise<Location[]> {
		await this.checkWorkspaceChanges();

		const defLocs = this.refs.filter(r => r.name.toUpperCase() == text.trim().toUpperCase())
			.map((projectReference) =>
			{
				return this.convertProjectReferenceToLocation(projectReference);
			}
		);

		return defLocs;
	}

	public async getDefinitionLink(text: string): Promise<LocationLink[]>
	{
		await this.checkWorkspaceChanges();

		const defLocs = this.refs.filter(r => (r.isDeclaration == true) && r.name.toUpperCase() == text.trim().toUpperCase())
			.map((projectReference) =>
			{
				return this.convertProjectReferenceToLocationLink(projectReference);
			}
		);

		return defLocs;
	}

	public convertProjectReferenceToLocation(projectReference: ProjectReference): Location {
		const loc: Location = {
			range: {
				start: { line: projectReference.line-1, character: 0 },
				end : { line: projectReference.line, character : 0 }
			},
			uri: projectReference.fileUri ,
		};
		return loc;
	}

	public convertProjectReferenceToLocationLink(projectReference: ProjectReference): LocationLink {
		const locLink: LocationLink = {
			targetRange: {
				start: { line: projectReference.line-1, character: 0 },
				end : { line: projectReference.line, character : 0 }
			},
			targetSelectionRange:
			{
				start: { line: projectReference.line-1, character: 0 },
				end : { line: projectReference.line, character : 0 }
			},
			targetUri: projectReference.fileUri,
			/* the API by default selects the word as the origin range and adds the link to it
			originSelectionRange: {
				start: { line: textPosition.position.line, character: textPosition.position.character-5 },
				end : { line: textPosition.position.line, character: textPosition.position.character+5 }
			}
			*/
		};
		return locLink;
	}
}


