//import {CodeLens, CodeLensParams, Definition, Connection, Location, ReferenceParams, SymbolInformation, SymbolKind} from 'vscode-languageserver';
import {Definition, Connection, Location, ReferenceParams, TextDocumentPositionParams, Range} from 'vscode-languageserver';

import { Handler } from './util';

/**
 * Gets the definition of a feature at a position.
 */
 export default class DefinitionFinder extends Handler {
	constructor(
		protected connection: Connection)
	//private converter: AnalyzerLSPConverter,
	//private featureFinder: FeatureFinder,
	//private analyzer: LsAnalyzer,
	//settings: Settings) {
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
		const locs: Location[] = [];

		const l: Location = {
			range: {
				start: { line: 5, character: 23 },
				end : { line: 6, character : 0 }
			},
			uri: textPosition.textDocument.uri ,
		};

		locs.push(l);
		return locs;
	}
	/* Get the current WORD to go the definition	 
	 MGG -the algorithm is obviously just a crude approximation and does not handle any edge case except line boundaries.
	 */
	private getWord(text: string, index: number) {
		const first = text.lastIndexOf(' ', index);
		const last = text.indexOf(' ', index);

		return text.substring(first !== -1 ? first : 0, last !== -1 ? last : text.length - 1);
	}

	/*
		MGG - useful links

		Overview of features - https://microsoft.github.io/language-server-protocol/overviews/lsp/overview/
		
		Example - https://vscode-docs.readthedocs.io/en/stable/extensions/example-language-server/
		
		CodeLens -https://code.visualstudio.com/blogs/2017/02/12/code-lens-roundup
	*/

}