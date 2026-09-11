import test from 'node:test';import assert from 'node:assert/strict';
import {selectCell,toggleValue} from '../src/game/selection.ts';
test('cell first clears previous highlight when the next square is empty',()=>{assert.deepEqual(selectCell('cell',2,0,false),{active:null,place:false});assert.deepEqual(selectCell('cell',2,7,true),{active:7,place:false});});
test('value first retains its armed value for repeated placement',()=>{assert.deepEqual(selectCell('value',2,0,false),{active:2,place:true});assert.deepEqual(selectCell('value',2,7,true),{active:7,place:false});});
test('tapping the armed value again clears it',()=>{assert.equal(toggleValue(2,2),null);assert.equal(toggleValue(2,3),3);assert.equal(toggleValue(null,3),3);});
