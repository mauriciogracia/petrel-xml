import { ProjectReference } from './project-reference';
import { ReferenceType } from "./reference-type";
import { Location, LocationLink, ReferenceParams, TextDocumentPositionParams, TextDocuments } from 'vscode-languageserver';
import fs = require('fs');
import readline = require('readline');
import { fileURLToPath, URL } from 'url';
import { Position, TextDocument } from 'vscode-languageserver-textdocument';

export class ReferenceManager {
	
	refs: ProjectReference[] = [];

	//reg expresion that matches any of the XML elements
	public TokenSeparatorsXML = /[\t= <>"]/;
	
	constructor(
		private documents: TextDocuments<TextDocument>)
	{ }

	public async update(txtDoc: TextDocument) {

		const url = new URL(txtDoc.uri);

		this.removeAllDocumentReferences(txtDoc.uri);

		const filePath = fileURLToPath(url);

		const fileStream = fs.createReadStream(filePath);

		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity
		});
		
		// Note: we use the crlfDelay option to recognize all instances of CR LF
		// ('\r\n') in input.txt as a single line break.
	
		let name:string;
		let lineNumber = 1;
		let isDeclaration: boolean;
		let createReference: boolean;
		let refType: ReferenceType;
			
		rl.on('line', (line) => {
			if (line.includes("<function ") || line.includes("<rule ")) {
				//Determine if it's a rule/function definition 
				refType = line.includes("<rule ") ? ReferenceType.Rule : ReferenceType.Function;
				name = this.getAttributeValueXML("name", line);
				createReference = (name !== '');
				isDeclaration = true;
			}
			else if (line.includes("<action ")) {
				refType = ReferenceType.Call;
				name = this.getAttributeValueXML("rulename", line);
				if (name.length == 0) { 
					name = this.getAttributeValueXML("function", line);
				}
				createReference = (name !== '');
				isDeclaration = false;
			}
			else {
				createReference = false;
			}

			if (createReference) {
				const pr: ProjectReference = new ProjectReference(refType, name, isDeclaration, txtDoc.uri, lineNumber);
				this.refs.push(pr);
				console.log(pr);
			}

			lineNumber++;
		});
	}

	public removeAllDocumentReferences(docUri: string)
	{
		//keep references for all documents that are not the especified by docUri 
		this.refs = this.refs.filter(r => r.fileUri != docUri);
	}
	public getSymbolAtPosition(position: Position, documentUri: string): string {

		console.log(position);

		const range = {
			start: { line: position.line, character: 0},
			end: { line: position.line, character: Number.MAX_VALUE  }
		};
		//get the whole line 
		const line = this.documents.get(documentUri)?.getText(range) || '';

		let start = position.character;
		while ((start > 0) && !line[start].match(this.TokenSeparatorsXML))
		{
			start--;
		}

		let end = position.character;
		while ((end < line.length) && !line[end].match(this.TokenSeparatorsXML))
		{
			end++;
		}

		const symbol = line.substr(start+1, end-start-1);

		console.log(`line: ${line}`) ;
		console.log(`${start}->${end}`);
		console.log(`symbol: ${symbol}`);

		return symbol;
	}

	public getAttributeValueXML(attributeName: string, line: string): string {
		let resp = '';

		//extract the tokens from a single XML line
		const tokens: string[] = line.split(this.TokenSeparatorsXML).filter(x => x);
		
		//look up the attribute by name and get the next token
		let attIndex = tokens.indexOf(attributeName);
		
		if ((attIndex > 0) && (attIndex < tokens.length-1))
		{
			/* To handle this case : 
			<action name="function" function="funABC" >

			We need the function name...and not the value ("function") 
			*/
			if (tokens[attIndex - 1].toLowerCase() === "name") {
				attIndex = tokens.indexOf(attributeName,attIndex+1);
			}

			if ((attIndex > 0) && (attIndex < tokens.length - 1)) {
			
				resp = tokens[attIndex + 1];
				console.log(resp);
			}
		}

		console.log(tokens);
		
		return resp;
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


