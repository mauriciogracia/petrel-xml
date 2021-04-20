import { ReferenceType } from './reference-type';


export class ProjectReference {
	type: ReferenceType; 
	name: string;
	isDeclaration: boolean;
	fileUri: string
	line: number;
	

	constructor(
		type: ReferenceType,
		name: string,
		isDeclaration: boolean,
		fileUri: string,
		line: number)
	{
		
		this.name = name;
		this.type = type;
		this.fileUri = fileUri;
		this.line = line;
		this.isDeclaration = isDeclaration;
	}
}


