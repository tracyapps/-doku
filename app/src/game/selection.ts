/** Selection is separate from entry so cell-first never leaves an old value armed. */
export function selectCell(mode:'cell'|'value',active:number|null,value:number,given:boolean){
 if(mode==='value'&&active&&!given)return {active,place:true};
 return {active:value||null,place:false};
}
export const toggleValue=(active:number|null,next:number)=>active===next?null:next;
