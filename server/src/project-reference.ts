import { ReferenceType } from './reference-type';


export class ProjectReference {
	name: string;
	type: ReferenceType; 
	fileUri: string 
	line: number;
	isDeclaration: boolean;

	constructor(name: string,
		type: ReferenceType,
		fileUri: string,
		line: number,
		isDeclaration: boolean) {
		
		this.name = name;
		this.type = type;
		this.fileUri = fileUri;
		this.line = line;
		this.isDeclaration = isDeclaration;

	}
}


