import { ReferenceType } from './reference-type';


export class ProjectReference {
	type: ReferenceType; 
	name: string;
	isDeclaration: boolean;
	fileUri: string;
	line: number;
	baseFolder: string;

	constructor(
		type: ReferenceType,
		name: string,
		isDeclaration: boolean,
		fileUri: string,
		line: number,
		baseFolder: string)
	{
		
		this.name = name;
		this.type = type;
		this.fileUri = fileUri;
		this.line = line;
		this.isDeclaration = isDeclaration;
		this.baseFolder = baseFolder;
	}

	public toString = (): string => {
		let fileUri;

		
		if (this.baseFolder.length !== 0)
		{
			fileUri = `$${this.fileUri.substr(this.baseFolder.length)}`;
		}
		else
		{
			fileUri = this.fileUri;
		}
		
		//const fileUri = this.fileUri;

		const resp = `ProjectReference = {type:${this.type}, name:${this.name}, isDeclaration:${this.isDeclaration}, fileUri:${fileUri}, line:${this.line}`;

		return resp;
	}
}


