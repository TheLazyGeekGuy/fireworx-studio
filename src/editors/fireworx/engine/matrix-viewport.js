// Presentation only. Never resize the DSP grid or move an engine/pipeline.
// `room`: DSP left for at least one more block (owner request 2026-10-21) — the readable view then keeps one free column
// after the last occupied one (up to 8) and one free row after the last occupied row. `growRows`: that free row may lie
// beyond the active rows (local draft only: placing a block there adds the row); `ghostRow` says so.
export function matrixViewport({cells=[],rows=4,target=null,room=false,growRows=false},mode='readable'){
 const activeRows=Math.max(1,Math.min(8,rows));
 const occupied=cells.filter(c=>(c.type??1)!==0&&c.row>=0&&c.row<activeRows&&c.col>=0&&c.col<8);
 const usedColumns=Math.max(0,...occupied.map(c=>c.col+1)),usedRows=Math.max(0,...occupied.map(c=>c.row+1));
 const focus=target&&target.row<activeRows&&target.row>=0&&target.col>=0&&target.col<8?target:null;
 const ghostRow=room&&growRows&&activeRows<8&&usedRows===activeRows;
 let columns=mode==='overview'?8:Math.max(6,usedColumns,(focus?.col??-1)+1);
 let visibleRows=mode==='overview'?activeRows:Math.max(Math.min(4,activeRows),usedRows,(focus?.row??-1)+1);
 if(room&&mode!=='overview'&&usedColumns>=6)columns=Math.min(8,Math.max(columns,usedColumns+1));
 if(room&&mode!=='overview'&&usedRows>=Math.min(4,activeRows)&&usedRows<activeRows)visibleRows=Math.max(visibleRows,usedRows+1);
 if(ghostRow)visibleRows=activeRows+1;
 return {columns,rows:visibleRows,heightRows:Math.min(4,visibleRows),activeRows,usedColumns,usedRows,ghostRow,full:mode==='overview',expanded:columns>6||visibleRows>4};
}
