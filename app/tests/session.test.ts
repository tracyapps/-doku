import test from 'node:test';import assert from 'node:assert/strict';
import {createPuzzle,candidates} from '../src/game/engine.ts';
import { ringToSeed } from '../src/game/ringdoku.ts';
import {newSession,resetSession,checkSession,enter,eraseCell,restore,autofill,reveal,stats,solved} from '../src/game/session.ts';
test('reset clears a daily board without changing puzzle identity or laundering assistance and first entries',()=>{
 const puzzle=createPuzzle('daily:2026-11-09:medium','classic','medium');
 let s=newSession(puzzle);const empty=s.values.indexOf(0),other=s.values.findIndex((v,i)=>!v&&i!==empty),wrong=puzzle.solution[empty]%9+1;
 s=enter(s,empty,wrong);s=enter(s,other,2,true);s=autofill(s);s={...s,seconds:85,challenge:{id:'challenge',attemptId:'attempt',token:'private-test-token'}};
 const before=structuredClone(s),r=resetSession(s);
 assert.equal(r.id,s.id);assert.equal(r.puzzle,s.puzzle);assert.deepEqual(r.challenge,s.challenge);assert.equal(r.startedAt,s.startedAt);
 assert.deepEqual(r.values,puzzle.givens);assert.ok(r.notes.every(n=>n.length===0));assert.deepEqual(r.past,[]);assert.deepEqual(r.future,[]);assert.equal(r.seconds,0);
 assert.deepEqual(r.first,s.first);assert.equal(stats(r).assisted,true);assert.equal(stats(r).accuracy,0);assert.deepEqual(r.events.slice(0,s.events.length),s.events);
 assert.ok(r.events.some(e=>e.kind==='set'&&e.cell===empty&&e.value===0));assert.equal(restore(r),r);assert.deepEqual(s,before);
 r.values[empty]=1;assert.notDeepEqual(r.values,s.values);r.notes[empty].push(1);assert.notDeepEqual(r.notes,s.notes);
});
test('reset leaves a completed session and its history intact',()=>{const s={...newSession(createPuzzle('reset-complete','classic','easy')),completedAt:'2026-11-09T18:00:00.000Z',submitted:true};assert.equal(resetSession(s),s);});
test('givens immutable; notes preserve slots and undo restores both entries and notes',()=>{const s=newSession(createPuzzle('state','classic','easy'));const given=s.values.findIndex(Boolean),empty=s.values.indexOf(0);assert.equal(enter(s,given,8),s);const n=enter(enter(s,empty,1,true),empty,9,true);assert.deepEqual(n.notes[empty],[1,9]);const filled=enter(n,empty,s.puzzle.solution[empty]);assert.deepEqual(filled.notes[empty],[]);assert.deepEqual(restore(filled).notes[empty],[1,9]);assert.equal(restore(restore(filled),true).values[empty],s.puzzle.solution[empty]);assert.equal(s.values[empty],0);});
test('accuracy keeps initial wrong pen entry after undo; notes never count; reveal excludes cells',()=>{const s=newSession(createPuzzle('accuracy','classic','easy'));const i=s.values.indexOf(0);const wrong=s.puzzle.solution[i]%9+1;let n=enter(s,i,wrong,true);assert.equal(stats(n).accuracy,null);n=enter(n,i,wrong);n=restore(n);n=enter(n,i,s.puzzle.solution[i]);assert.equal(stats(n).accuracy,0);n=enter(n,i,wrong);n=reveal(n,i);assert.equal(stats(n).accuracy,null);assert.equal(stats(n).reveals,1);assert.equal(stats(n).assisted,true);});
test('autofill is region aware and reversible; assistance survives undo',()=>{const s=newSession(createPuzzle('notes','jigsaw','hard'));const n=autofill(s);for(let i=0;i<81;i++)assert.deepEqual(n.notes[i],candidates(s.values,s.puzzle.regions,i));const previous=restore(n);assert.ok(previous.notes.every(n=>n.length===0));assert.equal(stats(previous).autofills,1);});
test('completed sessions are immutable; solved requires the actual solution',()=>{let s=newSession(createPuzzle('done','hue','easy'));assert.equal(solved(s),false);for(let i=0;i<81;i++)if(!s.values[i])s=enter(s,i,s.puzzle.solution[i]);assert.equal(solved(s),true);assert.equal(stats(s).accuracy,100);s={...s,completedAt:new Date().toISOString()};assert.equal(enter(s,0,0),s);assert.equal(restore(s),s);});
test('eraser clears either a pen value or all notes without changing givens',()=>{const s=newSession(createPuzzle('erase','classic','easy'));const given=s.values.findIndex(Boolean),empty=s.values.indexOf(0);const noted=enter(enter(s,empty,2,true),empty,4,true);assert.equal(eraseCell(noted,empty,false),noted);const notesErased=eraseCell(noted,empty,true);assert.deepEqual(notesErased.notes[empty],[]);const filled=enter(notesErased,empty,s.puzzle.solution[empty]);const valueErased=eraseCell(filled,empty,false);assert.equal(valueErased.values[empty],0);assert.equal(eraseCell(valueErased,given,false),valueErased);});

test('manual checks persist per cell across other edits, single-cell checks, and reload', () => {
 const puzzle = createPuzzle('daily:2026-11-23:easy', 'classic', 'easy');
 const [a, b, c] = puzzle.givens.flatMap((n, i) => n ? [] : [i]);
 const wrong = (cell: number) => puzzle.solution[cell] % 9 + 1;
 let s = enter(enter(newSession(puzzle), a, wrong(a)), b, wrong(b));
 s = checkSession(s).session;
 assert.deepEqual(s.checked, [a, b]);
 s = JSON.parse(JSON.stringify(enter(s, c, 3, true)));
 assert.deepEqual(s.checked, [a, b]);
 s = checkSession(s, c).session;
 assert.deepEqual(s.checked, [a, b]);
 s = enter(s, a, puzzle.solution[a]);
 assert.deepEqual(s.checked, [b]);
 s = restore(s);
 assert.deepEqual(s.checked, [b]);
 s = eraseCell(s, b);
 assert.deepEqual(s.checked, []);
 assert.deepEqual(resetSession(checkSession(s).session).checked, []);
 assert.equal(stats(s).checks, 2);
});

test('Ringdoku session actions use its cells, four symbols and overlapping peers', () => {
 const puzzle = createPuzzle(ringToSeed('ring-session'), 'ring', 'hard');
 let s = newSession(puzzle);
 const cell = s.values.indexOf(0);
 assert.equal(s.notes.length, 48);
 assert.equal(enter(s, 48, 1), s);
 assert.equal(enter(s, cell, 5), s);
 assert.equal(enter(s, cell, 1.5), s);
 s = autofill(s);
 assert.ok(s.notes[cell].length > 0);
 assert.ok(s.notes.every(notes => notes.every(n => n >= 1 && n <= 4)));
 s = restore(s);
 assert.ok(s.notes.every(notes => !notes.length));
 for (let i = 0; i < s.values.length; i++)
   if (!puzzle.givens[i]) s = enter(s, i, puzzle.solution[i]);
 assert.equal(solved(s), true);
 assert.equal(stats(s).accuracy, 100);
 assert.deepEqual(resetSession(s).values, puzzle.givens);
});
