//import {CodeLens, CodeLensParams, Definition, Connection, Location, ReferenceParams, SymbolInformation, SymbolKind} from 'vscode-languageserver';
import { Definition, Connection, Location, ReferenceParams, TextDocumentPositionParams, Range, TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ReferenceManager } from './reference-manager';

import { Handler } from './util';

/**
 * Gets the definition of a feature at a position.
 */
 export default class DefinitionFinder extends Handler {
	constructor(
		protected connection: Connection,
		private refManager: ReferenceManager,
		private documents: TextDocuments<TextDocument>)
	{
		super();

		this.connection.onDefinition(async (textPosition) => {
			return this.handleErrors(
				this.getDefinition(textPosition), undefined) as Promise<Definition>;
		});

		// this.connection.onReferences(async (params) => {
		// 	return this.handleErrors(this.getReferences(params), []);
		// });
	}
	/**
	 * Return the location or locations where the symbol referenced at the given
	 * location is defined.
	 *
	 * Implements:
	 * https://github.com/Microsoft/language-server-protocol/blob/master/protocol.md#textDocument_definition
	 */
	private async getDefinition(textPosition: TextDocumentPositionParams): Promise<Location[]> {

		const symbol = this.getSymbolAtPosition(textPosition);

		console.log(`symbol: ${symbol}`);

		return this.refManager.getDefinitionLocations(symbol);
	}
	
	private getSymbolAtPosition(textPosition: TextDocumentPositionParams):string {
		const range = {
			start: { line: textPosition.position.line, character: 0},
			end: { line: textPosition.position.line, character: Number.MAX_VALUE  }
		};
		//get the whole line 
		const line = this.documents.get(textPosition.textDocument.uri)?.getText(range) || '';
		const symbol = line;

		console.log(`line: ${line}`);

		return symbol;
	}
}