// Shared presentation for real Connect rights and explicitly labelled previews.
const targets={build:'#launchBtn',moves:'#moveLaunchBtn',one:'[data-mode="one"]',three:'[data-mode="three"]',five:'[data-mode="five"]',lives:'[data-variant="lives"]',sudden:'[data-variant="sudden"]'};
export function createXpHints({simulation=false}={}){
 const nodes=new Map();
 function hide(){for(const node of nodes.values())node.hidden=true;}
 function render(remaining,visible){
  if(!visible){hide();return;}
  for(const [kind,selector] of Object.entries(targets)){
   let node=nodes.get(kind);
   if(!node){
    const target=document.querySelector(selector);if(!target)continue;
    node=document.createElement('span');node.className='abaque-xp-remaining'+(simulation?' abaque-demo-xp':'');
    node.hidden=true;target.append(node);nodes.set(kind,node);
   }
   const value=remaining?.[kind],valid=Number.isSafeInteger(value)&&value>=0;
   node.hidden=!valid;node.textContent=valid?'Reste '+value+' XP':'';
  }
 }
 return Object.freeze({render,hide});
}
