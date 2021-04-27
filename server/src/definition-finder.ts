//import {CodeLens, CodeLensParams, Definition, Connection, Location, ReferenceParams, SymbolInformation, SymbolKind} from 'vscode-languageserver';
import { Connection, Location, ReferenceParams, TextDocumentPositionParams, Range, TextDocuments, LocationLink } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-textdocument';
import { ReferenceManager } from './reference-manager';

import { Handler } from './util';

/**
 * Gets the definition of a feature at a position.
 */
export default class DefinitionFinder extends Handler {
	//reg expresion that matches the XML elements relevant to this extension
	TokenSeparatorsXML = /[\t= <>"]/;
	
	constructor(
		protected connection: Connection,
		private refManager: ReferenceManager,
		)
	{
		super();

		this.connection.onDefinition(async (textPosition) => {
			return this.handleErrors(
				this.getDefinitionLink(textPosition), undefined) as Promise<LocationLink[]>;
		});

		this.connection.onReferences(async (params) => {
			return this.handleErrors(
				this.getReferences(params), []) as Promise<Location[]>;
		});
	}
	
	private async getDefinitionLink(textPosition: TextDocumentPositionParams): Promise<LocationLink[]> {
		const symbol = this.getSymbolAtPosition(textPosition.position, textPosition.textDocument.uri);

		return this.refManager.getDefinitionLink(symbol);
	}

	private async getReferences(params: ReferenceParams): Promise<Location[] | import("vscode-languageserver").ResponseError<void> | null | undefined> {
		const symbol = this.getSymbolAtPosition(params.position, params.textDocument.uri);

		return this.refManager.getReferences(symbol);
	}

	public getTextInRange(documentUri: string, range: Range):string {
		const txtDoc = this.refManager.getDocument(documentUri)!;
		return txtDoc.getText(range);
	}

	public getSymbolAtPosition(position: Position, documentUri: string): string {
		const range = {
			start: { line: position.line, character: 0},
			end: { line: position.line, character: Number.MAX_VALUE  }
		};

		const context = this.getTextInRange(documentUri, range);

		const offset = position.character;

		let start = offset-1;

		while ((start > 0) && !context[start].match(this.TokenSeparatorsXML))
		{
			start--;
		}
		
		let end = offset;

		while ((end < context.length) && !context[end].match(this.TokenSeparatorsXML))
		{
			end++;
		}

		const symbol = context.substr(start + 1, end - start - 1);

		console.log(`${start}->${end}- symbol: ${symbol}`);

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
			}
		}

		return resp;
	}
}