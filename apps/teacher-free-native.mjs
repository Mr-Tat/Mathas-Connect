// Connect capacity, not Master mode. Raw progress and awards remain untouched.
export function grantNativeTeacherAccess(html,teacherFree){
 if(teacherFree!==true)return html;
 const exact=(from,to,count)=>{if(html.split(from).length-1!==count)throw Error('Teacher access: incompatible native gate '+from);html=html.replaceAll(from,to)};
 const flag='window.__mathasTeacherFree===true';
 exact('if(!raw&&window.__masterMode){','if(!raw&&(window.__masterMode||'+flag+')){',2);
 if(html.includes('if(window.__masterMode===true)return true;'))exact('if(window.__masterMode===true)return true;','if(window.__masterMode===true||'+flag+')return true;',1);
 else exact('return window.__masterMode===true||level===1||hardSuddenBest(level-1)>=3','return '+flag+'||window.__masterMode===true||level===1||hardSuddenBest(level-1)>=3',1);
 exact('function hardLevelOpen(level){return level===1||hardSuddenBest(level-1)>=3||window.__masterMode===true}','function hardLevelOpen(level){return '+flag+'||level===1||hardSuddenBest(level-1)>=3||window.__masterMode===true}',1);
 exact('<head>','<head><script>Object.defineProperty(window,"__mathasTeacherFree",{value:true});</'+'script>',1);
 return html;
}
