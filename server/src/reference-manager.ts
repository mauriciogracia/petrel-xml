import { ProjectReference } from './project-reference';
import { ReferenceType } from "./reference-type";
import { Location, LocationLink, ReferenceParams, TextDocumentPositionParams, TextDocuments, _, _Connection } from 'vscode-languageserver';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';
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
			console.log({ obsoleteRefs: obsoleteRefs });
			obsoleteRefs.forEach(r => this.removeDocumentReferences(r));
		}

		//Determine if new files have not been referenced
		const filesNotReferenced = wsFilePaths.filter(fp => this.referencedDocs.indexOf(fp) == -1);

		if (filesNotReferenced.length > 0) {
			console.log({ filesNotReferenced: filesNotReferenced });
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
		let pr: ProjectReference | null ;

		this.removeDocumentReferences(docUri);

		//await this.checkWorkspaceChanges();

		allText = this.getAllDocumentText(docUri);

		if (allText.length > 0) {
			const lines = allText.split(/\r?\n/g);
	
			this.referencedDocs.push(docUri);

			console.log(`updating: ${docUri}`);

			lines.forEach((line, i) => {
				pr = null ;

				if (this.isDeclarationWithName(line)) {
					pr = this.referenceToDeclarationWithName(line,docUri,i+1) ;
				}
				else if (line.includes("<include-block ") || line.includes("<include ")) {
					pr = this.referenceIncludeBlock(line,docUri, i+1) ;
				}
				else if (line.includes("<action ")) {
					pr = this.referenceFromAction(line,docUri, i+1) ;
				}

				if (pr != null) {
					this.addProjectReference(pr);
				}
			});
		}
	}

	private addProjectReference(pr: ProjectReference) {
		this.refs.push(pr);
		console.log(`${pr}`);	
	}

	private referenceIncludeBlock(line:string, docUri: string, lineNum: number):ProjectReference | null{
		let pr : ProjectReference | null;
		let isDeclaration: boolean;
		let refType : ReferenceType;
		let name: string;

		/* Determine if it's declaration of an include block or is being used

		Declaration
		<include-block name="OEHRMasterTypes" meta-name="node">
		
		Usage 
		<include include-once="yes" block="OEHRMasterTypes"/>
		*/

		if(line.includes("<include-block "))
		{
			refType = ReferenceType.IncludeBlock ;
			name = this.definitionFinder.getAttributeValueXML("name", line);
			isDeclaration = true ;
		}
		else 
		{
			refType = ReferenceType.Reference ;
			name = this.definitionFinder.getAttributeValueXML("block", line);
			isDeclaration = false ;
		}

		const createReference = (name !== ''); 

		pr = null ;

		if (createReference) {
			pr = new ProjectReference(refType, name, isDeclaration, docUri, lineNum, this.projectFolder);
		}

		return pr ;
	}

	private isDeclarationWithName(line:string):boolean {
		return (line.includes("<function ") || line.includes("<rule ") || line.includes("<group ")) ; 
	}

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

		return refType! ;
	}

	private referenceToDeclarationWithName(line:string, docUri: string, lineNum: number):ProjectReference | null{
		let pr : ProjectReference | null;

		//Determine if it's a the type of definition rule/function/group 
		const refType = this.determinDeclarationType(line) ;
		const name = this.definitionFinder.getAttributeValueXML("name", line);
		const createReference = (name !== '');
		const isDeclaration = true;

		pr = null ;

		if (createReference) {
			pr = new ProjectReference(refType, name, isDeclaration, docUri, lineNum, this.projectFolder);
		}

		return pr ;
	}

	private referenceFromAction(line:string, docUri: string, lineNum: number){
		let pr : ProjectReference | null;

		const refType = ReferenceType.Reference;
		let name = '' ;
		
		if(line.includes("rulename")) {
			name = this.definitionFinder.getAttributeValueXML("rulename", line);
		}
		else if (line.includes("function")) {
			name = this.definitionFinder.getAttributeValueXML("function", line);
		}
		else if (line.includes("group")) {
			name = this.definitionFinder.getAttributeValueXML("group", line);
		}
		const createReference = (name !== '');
		const isDeclaration = false;

		pr = null ;

		if (createReference) {
			pr = new ProjectReference(refType, name, isDeclaration, docUri, lineNum, this.projectFolder);
		}

		return pr ;
	}

	/**
	 * Remove all references to the especified docUri
	 * 
	 * @param docUri 
	 */
	public removeDocumentReferences(docUri: string) {
		let removedRefs;

		removedRefs = 0;

		if (this.refs.some(pr => pr.fileUri === docUri)) {

			removedRefs = this.refs.length;
			
			this.refs = this.refs.filter(pr => pr.fileUri !== docUri);

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
			.map((pr) =>
			{
				return this.convertProjectReferenceToLocation(pr);
			}
		);

		return defLocs;
	}

	public async getDefinitionLink(text: string): Promise<LocationLink[]>
	{
		await this.checkWorkspaceChanges();

		const defLocs = this.refs.filter(r => (r.isDeclaration == true) && r.name.toUpperCase() == text.trim().toUpperCase())
			.map((pr) =>
			{
				return this.convertProjectReferenceToLocationLink(pr);
			}
		);

		return defLocs;
	}

	public convertProjectReferenceToLocation(pr: ProjectReference): Location {
		const loc: Location = {
			range: {
				start: { line: pr.line-1, character: 0 },
				end : { line: pr.line, character : 0 }
			},
			uri: pr.fileUri ,
		};
		return loc;
	}

	public convertProjectReferenceToLocationLink(pr: ProjectReference): LocationLink {
		const locLink: LocationLink = {
			targetRange: {
				start: { line: pr.line-1, character: 0 },
				end : { line: pr.line, character : 0 }
			},
			targetSelectionRange:
			{
				start: { line: pr.line-1, character: 0 },
				end : { line: pr.line, character : 0 }
			},
			targetUri: pr.fileUri,
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


