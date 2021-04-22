//import {CodeLens, CodeLensParams, Definition, Connection, Location, ReferenceParams, SymbolInformation, SymbolKind} from 'vscode-languageserver';
import { Definition, Connection, Location, ReferenceParams, TextDocumentPositionParams, Range, TextDocuments, LocationLink } from 'vscode-languageserver';
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
		)
	{
		super();

		this.connection.onDefinition(async (textPosition) => {
			return this.handleErrors(
				this.getDefinitionLink(textPosition), undefined) as Promise<LocationLink[]>;
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
		const symbol = this.refManager.getSymbolAtPosition(textPosition);

		return this.refManager.getDefinitionLocations(symbol);
	}
	
	private async getDefinitionLink(textPosition: TextDocumentPositionParams): Promise<LocationLink[]> {
		const symbol = this.refManager.getSymbolAtPosition(textPosition);

		return this.refManager.getDefinitionLink(symbol);
	}
}