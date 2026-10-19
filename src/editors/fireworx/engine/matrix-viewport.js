// Presentation only. Never resize the DSP grid or move an engine/pipeline.
export function matrixViewport({cells=[],rows=4,target=null},mode='readable'){
 const activeRows=Math.max(1,Math.min(8,rows));
 const occupied=cells.filter(c=>(c.type??1)!==0&&c.row>=0&&c.row<activeRows&&c.col>=0&&c.col<8);
 const usedColumns=Math.max(0,...occupied.map(c=>c.col+1)),usedRows=Math.max(0,...occupied.map(c=>c.row+1));
 const focus=target&&target.row<activeRows&&target.row>=0&&target.col>=0&&target.col<8?target:null;
 const columns=mode==='overview'?8:Math.max(6,usedColumns,(focus?.col??-1)+1);
 const visibleRows=mode==='overview'?activeRows:Math.max(Math.min(4,activeRows),usedRows,(focus?.row??-1)+1);
 return {columns,rows:visibleRows,heightRows:Math.min(4,visibleRows),activeRows,usedColumns,usedRows,full:mode==='overview',expanded:columns>6||visibleRows>4};
}
