import { ProjectReference } from './project-reference';
import { ReferenceType } from "./reference-type";
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Location } from 'vscode-languageserver';

export class ReferenceManager {
	refs: ProjectReference[] = [];
	
	public update(txtDoc: TextDocument) {
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


