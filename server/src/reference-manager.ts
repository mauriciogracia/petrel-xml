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

		console.log({ referencedDocs: this.referencedDocs });
		console.log({ wsFilePaths: wsFilePaths });
		//Determine if the referenced docs does not match the xml files in the workspace 
		const obsoleteRefs = this.referencedDocs.filter(rd => wsFilePaths.indexOf(rd) == -1);
		console.log({ obsoleteRefs: obsoleteRefs });
	}

	public toFullPath(relPath: string): string 
	{
		return (this.projectFolder + '/' + relPath);
	}

	public async updateWorkspaceReferences(workspaceFolders: WorkspaceFolder[]) {
		this.projectFolder = workspaceFolders[0].uri;
		console.log(`Updating references for: ${this.projectFolder}`);

		const wsFilePaths = await this.getWorkspaceFilePaths();
		console.log(wsFilePaths);

		wsFilePaths.forEach(async p => await this.updateDocumentReferences(p));
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
		let name:string;
		let isDeclaration: boolean;
		let createReference: boolean;
		let refType: ReferenceType;

		this.removeAllDocumentReferences(docUri);

		await this.checkWorkspaceChanges();

		allText = this.getAllDocumentText(docUri);

		if (allText.length > 0) {
			const lines = allText.split(/\r?\n/g);
	
			this.referencedDocs.push(docUri);

			console.log(`updating: ${docUri}`);

			lines.forEach((line, i) => {
				if (line.includes("<function ") || line.includes("<rule ")) {
					//Determine if it's a rule/function definition 
					refType = line.includes("<rule ") ? ReferenceType.Rule : ReferenceType.Function;
					name = this.definitionFinder.getAttributeValueXML("name", line);
					createReference = (name !== '');
					isDeclaration = true;
				}
				else if (line.includes("<action ")) {
					refType = ReferenceType.Call;
					name = this.definitionFinder.getAttributeValueXML("rulename", line);
					if (name.length == 0) {
						name = this.definitionFinder.getAttributeValueXML("function", line);
					}
					createReference = (name !== '');
					isDeclaration = false;
				}
				else {
					createReference = false;
				}

				if (createReference) {
					const pr: ProjectReference = new ProjectReference(refType, name, isDeclaration, docUri, i + 1, this.projectFolder);
					this.refs.push(pr);
					console.log(`${pr}`);
				}
			});
		}
	}

	public showAllReferences(message: string) {
		
		console.log(`------------${message}------------`);
		this.refs.forEach((pr) => { console.log(`${pr}`); });
	}

	public removeAllDocumentReferences(docUri: string) {
		if (this.refs.some(pr => pr.fileUri === docUri)) {
			//keep references for all documents that are not the especified by docUri 
			this.refs = this.refs.filter(pr => pr.fileUri !== docUri);

			const index = this.referencedDocs.indexOf(docUri);
			if (index > -1) {
				this.referencedDocs.splice(index, 1);
			}
		}
	}

	

	

	public getReferences(text: string): Location[] {
		const defLocs = this.refs.filter(r => r.name.toUpperCase() == text.trim().toUpperCase())
			.map((pr) =>
			{
				return this.ReferenceToLocation(pr);
			}
		);

		return defLocs;
	}

	public getDefinitionLocations(text: string): Location[]
	{
		const defLocs = this.refs.filter(r => (r.isDeclaration == true) && r.name.toUpperCase() == text.trim().toUpperCase())
			.map((pr) =>
			{
				return this.ReferenceToLocation(pr);
			}
		);

		return defLocs;
	}

	public getDefinitionLink(text: string): LocationLink[]
	{
		const defLocs = this.refs.filter(r => (r.isDeclaration == true) && r.name.toUpperCase() == text.trim().toUpperCase())
			.map((pr) =>
			{
				return this.ReferenceToLocationLink(pr);
			}
		);

		return defLocs;
	}

	public ReferenceToLocation(pr: ProjectReference): Location {
		const loc: Location = {
			range: {
				start: { line: pr.line-1, character: 0 },
				end : { line: pr.line, character : 0 }
			},
			uri: pr.fileUri ,
		};
		return loc;
	}

	public ReferenceToLocationLink(pr: ProjectReference): LocationLink {
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


