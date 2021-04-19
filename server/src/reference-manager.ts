import { ProjectReference } from './project-reference';
import { ReferenceType } from "./reference-type";
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Location } from 'vscode-languageserver';
import fs = require('fs');
import readline = require('readline');
import { sep } from 'path';
import { fileURLToPath, URL } from 'url';

export class ReferenceManager {
	refs: ProjectReference[] = [];
	
	public async update(txtDoc: TextDocument) {

		const url = new URL(txtDoc.uri);

		const filePath = fileURLToPath(url);

		const fileStream = fs.createReadStream(filePath);

		const rl = readline.createInterface({
			input: fileStream,
			crlfDelay: Infinity
		});
		
		// Note: we use the crlfDelay option to recognize all instances of CR LF
		// ('\r\n') in input.txt as a single line break.
	
		rl.on('line', (line) => {
			if (line.includes("<function")
				|| line.includes("<rule")) {
					console.log(`declaration: ${line}`);
				}
			
		});

		/*************  testing below */
		let pr: ProjectReference = new ProjectReference("ruleABC", ReferenceType.Rule, txtDoc.uri, 2, true);
		this.refs.push(pr);

		pr = new ProjectReference("funABC", ReferenceType.Function, txtDoc.uri, 24, true);
		this.refs.push(pr);
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
}


