export type Conflict = {group:{name:string;cells:number[]};value:number;cells:number[]};
export function findConflicts(groups:Conflict['group'][],values:number[]):Conflict[];
export function describeConflict(conflict:Conflict,cellName:(cell:number)=>string):string;
