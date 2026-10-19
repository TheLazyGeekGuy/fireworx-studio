// Native buttons retain their actions, state and accessible names.
const commands={
 randomize:['Randomize — aperçu de paramètres ou de structure','M4 3h16v18H4zM8 7h.01M16 7h.01M12 12h.01M8 17h.01M16 17h.01'],
 undo:['Annuler','M9 5 4 10l5 5M4 10h9a7 7 0 0 1 7 7'],
 redo:['Rétablir','m15 5 5 5-5 5M20 10h-9a7 7 0 0 0-7 7'],
 'new-study':['Nouveau patch','M14 3H5v18h14V8l-5-5Zm0 0v5h5M12 11v7m-3-3h6'],
 'open-study':['Ouvrir un brouillon ou preset JSON','M3 8V5h6l3 3h9v3M3 8v12h16l3-9H7l-4 9'],
 'save-study':['Sauvegarder la chaîne et ses réglages en JSON','M4 3h13l3 3v15H4V3Zm4 0v6h8V3M8 21v-8h8v8'],
 export:['Sauvegarder la chaîne et ses réglages en JSON','M4 3h13l3 3v15H4V3Zm4 0v6h8V3M8 21v-8h8v8'],
 'device-tools':['MIDI / Buffer — connexion et transferts','M7 3v4m10-4v4M5 7h14v5a7 7 0 0 1-14 0V7Zm7 12v3M9 11h.01M15 11h.01M12 14h.01'],
 'device-export':['Exporter le preset en SysEx (.syx)','M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'],
 'device-draft':['Revenir au brouillon local','M14 3H5v18h14V8l-5-5Zm0 0v5h5M10 11l-3 3 3 3m-3-3h6a3 3 0 0 1 3 3']
};
export function decorateToolbar(root){
 for(const [id,[label,path]] of Object.entries(commands)){
  const button=root.querySelector(`#${id}`);if(!button)continue;
  button.classList.add('icon-command');button.setAttribute('aria-label',label);button.dataset.hint=label;
  button.innerHTML=`<svg class="toolbar-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`;
 }
}
