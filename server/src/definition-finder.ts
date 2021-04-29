//import {CodeLens, CodeLensParams, Definition, Connection, Location, ReferenceParams, SymbolInformation, SymbolKind} from 'vscode-languageserver';
import { parse } from 'fast-xml-parser';
import { Connection, Location, ReferenceParams, TextDocumentPositionParams, Range, TextDocuments, LocationLink, FileOperationPatternKind } from 'vscode-languageserver';
import { Position } from 'vscode-languageserver-textdocument';
import { ReferenceManager } from './reference-manager';
import { Handler } from './util';

/**
 * Gets the definition of a feature at a position.
 */
export default class DefinitionFinder extends Handler {
	//reg expresion that matches the XML elements relevant to this extension
	TokenSeparatorsXML = /[\t= <>"]/;
	
	//parsing options for the fast-xml-parser
	xmlParseOptions = {
		attributeNamePrefix : "",
		ignoreAttributes : false,
		ignoreNameSpace : true,
		parseNodeValue : true,
		parseAttributeValue : false,
		trimValues: true,
		parseTrueNumberOnly: false,
		arrayMode: false, //"strict"
		stopNodes: ["parse-me-as-string"]
	};

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


	public parseXML(line: string) {
		let jsonXML = '' ;

		try { 
			jsonXML = parse(line,this.xmlParseOptions) ;
		}
		catch
		{

		}

		return jsonXML ;
	}

	public getAttributeValueXML(attributeName: string, json: any): string {
		let tagName = '' ;
		let value = '' ;

		if((json !== undefined) &&  Object.keys(json).length > 0)
		{
			tagName= Object.keys(json)[0] ;
			if(tagName !== '')
			{
				value = json[tagName][attributeName] ;
			}
		} 
		
		return value ;
	}
}