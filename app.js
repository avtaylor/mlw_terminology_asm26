function externalRefsHTML(refs){
  if(!refs || !refs.length) return '<span class="muted">No external reference added.</span>';
  return refs.map(r=>`<a class="external-ref" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.label)} ↗</a>`).join(" ");
}

let DATA, filtered=[], selected=null, domainLevel=1, networkLevel=1;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
let termMatchers=[];
function buildTermMatchers(){
  const candidates=[];
  DATA.terms.forEach(t=>{
    candidates.push({text:t.term,term:t});
    if(t.abbr && String(t.abbr).trim().length>1) candidates.push({text:String(t.abbr).trim(),term:t});
  });
  const seen=new Set();
  termMatchers=candidates
    .filter(x=>x.text && !seen.has(x.text.toLowerCase()) && seen.add(x.text.toLowerCase()))
    .sort((a,b)=>b.text.length-a.text.length);
}
function termLinkHTML(text,currentAbstractId=""){
  if(!text) return "";
  const s=String(text), lower=s.toLowerCase(), hits=[];
  for(const m of termMatchers){
    const needle=m.text.toLowerCase();
    let pos=0;
    while((pos=lower.indexOf(needle,pos))!==-1){
      const before=pos===0?"":s[pos-1], after=pos+needle.length>=s.length?"":s[pos+needle.length];
      const leftOK=!/[A-Za-z0-9]/.test(before), rightOK=!/[A-Za-z0-9]/.test(after);
      if(leftOK&&rightOK && !hits.some(h=>pos<h.end && pos+needle.length>h.start)){
        hits.push({start:pos,end:pos+needle.length,term:m.term}); pos+=needle.length;
      } else pos+=Math.max(1,needle.length);
    }
  }
  hits.sort((a,b)=>a.start-b.start);
  let out="",cursor=0;
  for(const h of hits){
    out+=esc(s.slice(cursor,h.start));
    const t=h.term;
    const occ=currentAbstractId?t.occurrences.find(o=>String(o.abstractId)===String(currentAbstractId).padStart(2,"0")):null;
    const current=occ?.interpretation||"";
    const tip=`${t.term}${t.abbr?" ("+t.abbr+")":""}\n${t.domain}\n\n${current&&current!==t.definition?"In this abstract: "+current+"\n\n":""}${t.definition||"Definition not reconstructable from the supplied abstract text."}`;
    out+=`<button type="button" class="dict-link" data-term-id="${t.id}" data-tip="${esc(tip)}">${esc(s.slice(h.start,h.end))}</button>`;
    cursor=h.end;
  }
  out+=esc(s.slice(cursor));
  return out;
}
let termReturnOrigins=[];
function currentViewName(){
  const active=document.querySelector(".tab.active");
  return active?.dataset.view || "domains";
}
function viewLabel(view){
  return ({domains:"Domains",dictionary:"previous term",dashboard:"Understanding terms across disciplines",network:"Domain-Term-Abstract Network",abstracts:"Abstracts"})[view] || "previous view";
}
function captureTermOrigin(el=null){
  const view=currentViewName();
  termReturnOrigins.push({
    view,
    scrollY:window.scrollY,
    abstractId:el?.dataset?.abstractId || el?.closest?.("[data-abstract-id]")?.dataset.abstractId || "",
    termId:el?.dataset?.termId || "",
    text:(el?.textContent||"").trim(),
    selectedTermId:view==="dictionary"&&selected?selected.id:null
  });
  if(termReturnOrigins.length>20) termReturnOrigins.shift();
}
function restoreTermOrigin(){
  if(!termReturnOrigins.length) return;
  const origin=termReturnOrigins.pop();
  switchView(origin.view);
  if(origin.view==="dictionary" && origin.selectedTermId){
    $("#q").value=""; $("#domain").value=""; $("#varies").value="";
    renderDictionary(); selectTerm(origin.selectedTermId);
  }
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    window.scrollTo({top:origin.scrollY,left:0,behavior:"auto"});
    let target=null;
    if(origin.abstractId){
      target=document.querySelector(`[data-abstract-id="${CSS.escape(origin.abstractId)}"] .dict-link[data-term-id="${CSS.escape(String(origin.termId))}"]`);
    }
    if(!target && origin.view!=="dictionary"){
      target=[...document.querySelectorAll(`#${CSS.escape(origin.view)} .dict-link[data-term-id="${CSS.escape(String(origin.termId))}"]`)]
        .find(x=>(x.textContent||"").trim()===origin.text) || null;
    }
    if(target){
      target.classList.add("return-highlight");
      target.focus({preventScroll:true});
      setTimeout(()=>target.classList.remove("return-highlight"),1600);
    }
  }));
}

function wireDictionaryLinks(root=document){
  root.querySelectorAll(".dict-link").forEach(b=>{
    if(b.dataset.wired) return; b.dataset.wired="1";
    b.addEventListener("mouseenter",showTermTip); b.addEventListener("focus",showTermTip);
    b.addEventListener("mouseleave",hideTermTip); b.addEventListener("blur",hideTermTip);
    b.addEventListener("click",e=>{
      e.stopPropagation(); hideTermTip();
      const id=+b.dataset.termId;
      captureTermOrigin(b);
      switchView("dictionary"); $("#q").value=""; $("#domain").value=""; $("#varies").value="";
      renderDictionary(); selectTerm(id);
      const row=document.querySelector(`#results .term-row[data-id="${id}"]`);
      if(row) row.scrollIntoView({behavior:"smooth",block:"center"});
    });
  });
}
function showTermTip(e){
  const b=e.currentTarget, tip=$("#termTooltip");
  tip.innerHTML=esc(b.dataset.tip).replace(/\n/g,"<br>");
  const r=b.getBoundingClientRect();
  tip.style.left=Math.max(8,Math.min(window.innerWidth-328,r.left))+"px";
  tip.style.top=(r.bottom+8+window.scrollY)+"px"; tip.hidden=false;
}
function hideTermTip(){const t=$("#termTooltip"); if(t)t.hidden=true}
async function init(){
  DATA=await fetch("data.json").then(r=>r.json());
  buildTermMatchers();
  $("#meta").textContent=`${DATA.meta.terms} terms · ${DATA.meta.abstracts} detailed abstracts · ${DATA.meta.sourcePages} PDF pages`;
  const domains=[...new Set(DATA.terms.map(t=>t.domain))].sort();
  $("#domain").innerHTML='<option value="">All domains</option>'+domains.map(d=>`<option>${esc(d)}</option>`).join("");
  ["q","domain","varies"].forEach(id=>$("#"+id).addEventListener(id==="q"?"input":"change",renderDictionary));
  $$(".tab").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
  $("#domainL1").addEventListener("click",()=>{domainLevel=1; setLevelButtons("domain",1); renderDomains()});
  $("#domainL2").addEventListener("click",()=>{domainLevel=2; setLevelButtons("domain",2); renderDomains()});
  $("#networkL1").addEventListener("click",()=>{networkLevel=1; setLevelButtons("network",1); renderNetwork()});
  $("#networkL2").addEventListener("click",()=>{networkLevel=2; setLevelButtons("network",2); renderNetwork()});
  $$("[data-start-view]").forEach(b=>b.addEventListener("click",()=>chooseAnalysis(b.dataset.startView)));
  $("#changeAnalysis").addEventListener("click",showAnalysisChooser);
  initDashboard(); renderDictionary(); renderDomains(); renderAbstracts();
}
function chooseAnalysis(view){
  $("#start").hidden=true;
  $("#workspace").hidden=false;
  switchView(view);
  window.scrollTo({top:0,behavior:"auto"});
}
function showAnalysisChooser(){
  $("#workspace").hidden=true;
  $("#start").hidden=false;
  hideTermTip();
  window.scrollTo({top:0,behavior:"auto"});
}
function switchView(v){
  $$(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
  $$(".view").forEach(x=>x.hidden=x.id!==v);
  if(v==="network") renderNetwork();
  if(v==="dashboard") renderDashboard();
}
function renderDictionary(){
  const q=$("#q").value.trim().toLowerCase(), dom=$("#domain").value, vv=$("#varies").value;
  filtered=DATA.terms.filter(t=>{
    const hay=[t.term,t.abbr,t.domain,t.definition,t.sources,...t.occurrences.flatMap(o=>[o.title,o.interpretation,o.context])].join(" ").toLowerCase();
    return (!q||hay.includes(q))&&(!dom||t.domain===dom)&&(!vv||(vv==="yes"?t.varies:!t.varies));
  }).sort((a,b)=>a.term.localeCompare(b.term));
  $("#count").textContent=`${filtered.length} matching terms`;
  $("#results").innerHTML=filtered.length?filtered.map(t=>`<div class="term-row" data-id="${t.id}" tabindex="0"><div class="term-head"><div><span class="term-name">${esc(t.term)}</span>${t.abbr?` <span class="abbr">(${esc(t.abbr)})</span>`:""}</div><span class="pill">${esc(t.domain)}</span></div><div class="snippet">${esc(t.definition||"Definition not reconstructable from the supplied abstract text.")}</div><div><span class="pill">${t.count} abstract${t.count===1?"":"s"}</span>${t.varies?'<span class="pill varies">interpretation varies</span>':""}</div></div>`).join(""):'<div class="empty">No terms match these filters.</div>';
  $$("#results .term-row").forEach(el=>{const go=()=>selectTerm(+el.dataset.id);el.addEventListener("click",go);el.addEventListener("keydown",e=>{if(e.key==="Enter")go()})});
  if(filtered.length && (!selected || !filtered.some(t=>t.id===selected.id))) selectTerm(filtered[0].id); else if(!filtered.length) $("#detail").innerHTML='<div class="empty">Select a term to inspect its sources.</div>';
}
function selectTerm(id){
  selected=DATA.terms.find(t=>t.id===id);
  $$("#results .term-row").forEach(x=>x.classList.toggle("active",+x.dataset.id===id));
  const t=selected;
  $("#detail").innerHTML=`${termReturnOrigins.length?`<button type="button" class="return-origin" id="returnOrigin">← Go back to ${esc(viewLabel(termReturnOrigins[termReturnOrigins.length-1].view))}</button>`:""}<h2>${esc(t.term)} ${t.abbr?`<span class="abbr">(${esc(t.abbr)})</span>`:""}</h2><div><span class="pill">${esc(t.domain)}</span>${t.varies?'<span class="pill varies">interpretation varies</span>':""}</div><h3>Canonical definition</h3><p>${esc(t.definition||"Not reconstructable from the supplied abstract text.")}</p><h3>External references</h3><div class="external-references">${externalRefsHTML(t.externalReferences)}</div><small class="external-note">Searches MeSH using any word in the term.</small><h3>Use across abstracts</h3>${t.occurrences.map(o=>`<div class="occ"><div class="occ-title">Abstract ${esc(o.abstractId)} — ${esc(o.title)}</div><div class="occ-meta">${esc(o.section)} · PDF page ${esc(o.page)}</div><p class="linked-text">${termLinkHTML(o.interpretation||"No separate interpretation could be reconstructed.",o.abstractId)}</p><details><summary>Context</summary><p class="snippet linked-text">${termLinkHTML(o.context,o.abstractId)}</p></details></div>`).join("")}`;
  wireDictionaryLinks($("#detail"));
  const back=$("#returnOrigin");
  if(back) back.addEventListener("click",restoreTermOrigin);
}
function setLevelButtons(prefix,level){
  $("#"+prefix+"L1").classList.toggle("active",level===1); $("#"+prefix+"L2").classList.toggle("active",level===2);
}
function renderDomains(){
  const field=domainLevel===1?"domainLevel1":"domain", counts={};
  DATA.terms.forEach(t=>counts[t[field]]=(counts[t[field]]||0)+1);
  $("#domainNote").textContent=domainLevel===1?"Level 1 merges related specialist domains. Select one to see all terms beneath it.":"Level 2 preserves the original specialist domain labels. Select one to filter the dictionary.";
  $("#domainGrid").innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([d,n])=>`<button class="domain-card" data-domain="${esc(d)}"><strong>${esc(d)}</strong><span>${n} term${n===1?"":"s"}</span></button>`).join("");
  $$("#domainGrid .domain-card").forEach(b=>b.addEventListener("click",()=>{
    switchView("dictionary");
    if(domainLevel===2){$("#domain").value=b.dataset.domain; renderDictionary()}
    else{
      $("#domain").value=""; const wanted=b.dataset.domain;
      filtered=DATA.terms.filter(t=>t.domainLevel1===wanted).sort((a,b)=>a.term.localeCompare(b.term));
      $("#q").value=""; $("#varies").value="";
      renderResultSet(`${filtered.length} terms in ${wanted}`);
    }
  }));
}
function renderResultSet(label){
  $("#count").textContent=label;
  $("#results").innerHTML=filtered.map(t=>`<div class="term-row" data-id="${t.id}" tabindex="0"><div class="term-head"><div><span class="term-name">${esc(t.term)}</span>${t.abbr?` <span class="abbr">(${esc(t.abbr)})</span>`:""}</div><span class="pill">${esc(t.domain)}</span></div><div class="snippet">${esc(t.definition||"Definition not reconstructable from the supplied abstract text.")}</div><div><span class="pill">${t.count} abstract${t.count===1?"":"s"}</span>${t.varies?'<span class="pill varies">interpretation varies</span>':""}</div></div>`).join("");
  $$("#results .term-row").forEach(el=>{const go=()=>selectTerm(+el.dataset.id);el.addEventListener("click",go);el.addEventListener("keydown",e=>{if(e.key==="Enter")go()})});
  if(filtered.length) selectTerm(filtered[0].id);
}
let abstractDomainLevel=1, abstractDomainSelection="", streamAbstractSelection=null;
function abstractDomainFor(a, level){
  if(level===2) return a["Section"] || "Unclassified";
  const aid=String(a["Abstract ID"]).padStart(2,"0");
  const counts={};
  DATA.terms.forEach(t=>{
    if(t.occurrences?.some(o=>String(o.abstractId).padStart(2,"0")===aid)){
      const d=t.domainLevel1||"Other biomedical & public health methods";
      counts[d]=(counts[d]||0)+1;
    }
  });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||"Unclassified";
}
function renderAbstractDomainFilter(){
  const box=$("#abstractDomainGrid");
  if(!box)return;
  const counts={};
  DATA.abstracts.forEach(a=>{
    const d=abstractDomainFor(a,abstractDomainLevel);
    counts[d]=(counts[d]||0)+1;
  });
  box.innerHTML=`<button type="button" class="abstract-domain-card ${!abstractDomainSelection?"active":""}" data-domain=""><strong>All domains</strong><span>${DATA.abstracts.length} abstracts</span></button>`+
    Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([d,n])=>
      `<button type="button" class="abstract-domain-card ${abstractDomainSelection===d?"active":""}" data-domain="${esc(d)}"><strong>${esc(d)}</strong><span>${n} abstract${n===1?"":"s"}</span></button>`).join("");
  box.querySelectorAll(".abstract-domain-card").forEach(b=>b.addEventListener("click",()=>{
    streamAbstractSelection=null;
    abstractDomainSelection=b.dataset.domain;
    renderAbstractDomainFilter();
    filterAbstracts();
  }));
  $("#abstractDomainL1")?.classList.toggle("active",abstractDomainLevel===1);
  $("#abstractDomainL2")?.classList.toggle("active",abstractDomainLevel===2);
}
function renderAbstracts(){
  $("#abstractList").innerHTML=DATA.abstracts.map(a=>{
    const aid=String(a["Abstract ID"]).padStart(2,"0");
    const abstractHTML=termLinkHTML(a.actualAbstract||"Abstract text was not recovered from the supplied PDF.",aid)
      .replace(/\b(KEYWORDS|INTRODUCTION|BACKGROUND|AIM|OBJECTIVE|METHODS|RESULTS|DISCUSSION|CONCLUSION)\b/g,'<strong class="section-label">$1</strong>');
    return `<article class="abstract-card full-abstract" data-article-id="${esc(aid)}">
      <details class="abstract-collapse">
        <summary class="abstract-heading"><span class="abstract-title">Abstract ${esc(aid)}: ${esc(a["Abstract title"])}</span><small>${esc(a["Section"])} · PDF page ${esc(a["PDF page"])} · Click to read abstract</small>
        <span class="abstract-authors">${a.authors?`<strong>Authors:</strong> ${esc(a.authors)}`:`<strong>Presenting author:</strong> ${esc(a.presentingAuthor||"Not available in extracted handbook text")}`}</span></summary>
        <div class="actual-abstract"><h3>Abstract</h3><p class="linked-text selectable-abstract" data-abstract-id="${esc(aid)}">${abstractHTML}</p></div>
      </details>
      <button type="button" class="return-origin network-article-back" hidden>← Back to Domain-Term-Abstract Network</button>
    </article>`;
  }).join("");
  wireDictionaryLinks($("#abstractList"));
  wireAmbiguityCollector($("#abstractList"));
  // Initialise domain cards and their level controls after the abstracts exist.
  $("#abstractDomainL1").addEventListener("click",()=>{
    streamAbstractSelection=null;
    abstractDomainLevel=1;
    abstractDomainSelection="";
    renderAbstractDomainFilter();
    filterAbstracts();
  });
  $("#abstractDomainL2").addEventListener("click",()=>{
    streamAbstractSelection=null;
    abstractDomainLevel=2;
    abstractDomainSelection="";
    renderAbstractDomainFilter();
    filterAbstracts();
  });
  renderAbstractDomainFilter();
  filterAbstracts();
}

let ambiguitySelections=[];
function ambiguityPanelHTML(){
  return `<aside class="ambiguity-panel" id="ambiguityPanel">
    <div class="abstract-filter">
      <h3>Search abstracts</h3>
      <label for="abstractKeywordFilter">Keyword
        <input type="search" id="abstractKeywordFilter" placeholder="Search title or abstract…" autocomplete="off">
      </label>
      <div id="abstractFilterStatus" class="abstract-filter-status" aria-live="polite"></div>
    </div>
    <h3>Suggest ambiguous terms</h3>
    <p>Select text in any abstract by dragging over it, or double-click a word. Each selection is recorded as <strong>(abstract, word/phrase)</strong>.</p>
    <div id="ambiguityTuples" class="ambiguity-tuples" aria-live="polite"></div>
    <label>Your discipline
      <select id="ambiguityDiscipline">
        <option value="">Select your discipline…</option>
        ${DATA.meta.disciplineDashboard.disciplines.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join("")}
      </select>
    </label>
    <label>Optional comment
      <textarea id="ambiguityComment" rows="2" placeholder="Anything you would like to add"></textarea>
    </label>
    <button type="button" id="submitAmbiguity">Submit suggestions</button>
    <div id="ambiguityStatus" class="submission-status" role="status" aria-live="polite"></div>
    <small>Submissions are recorded in the MLW terminology feedback spreadsheet. No name or email address is collected.</small>
  </aside>`;
}
function ensureAmbiguityPanel(){
  if($("#ambiguityPanel")) return;
  const list=$("#abstractList");
  let shell=list.parentElement;
  if(!shell.classList.contains("abstract-feedback-layout")){
    const wrap=document.createElement("div");
    wrap.className="abstract-feedback-layout";
    shell.insertBefore(wrap,list);
    wrap.appendChild(list);
    shell=wrap;
  }
  shell.insertAdjacentHTML("beforeend",ambiguityPanelHTML());
  $("#submitAmbiguity").addEventListener("click",submitAmbiguitySelections);
  $("#abstractKeywordFilter").addEventListener("input",filterAbstracts);
  filterAbstracts();
  renderAmbiguitySelections();
}
function filterAbstracts(){
  const input=$("#abstractKeywordFilter");
  if(!input) return;
  const q=input.value.trim().toLowerCase();
  let shown=0;
  $$("#abstractList .abstract-card").forEach((card,i)=>{
    const a=DATA.abstracts[i];
    const matchesDomain=!abstractDomainSelection || abstractDomainFor(a,abstractDomainLevel)===abstractDomainSelection;
    const match=matchesDomain && (!streamAbstractSelection || streamAbstractSelection.has(String(a["Abstract ID"]).padStart(2,"0"))) && (!q || [a["Abstract title"],a.actualAbstract,a["Section"],a["Abstract ID"]].join(" ").toLowerCase().includes(q));
    card.hidden=!match;
    if(match) shown++;
  });
  const status=$("#abstractFilterStatus");
  if(status) status.textContent=q?`${shown} matching abstract${shown===1?"":"s"}`:`${shown} abstracts`;
}
function addAmbiguitySelection(aid,phrase){
  phrase=(phrase||"").replace(/\s+/g," ").trim();
  if(!phrase || phrase.length>180) return;
  if(!ambiguitySelections.some(x=>x.article===aid && x.word.toLowerCase()===phrase.toLowerCase())){
    ambiguitySelections.push({article:aid,word:phrase});
    renderAmbiguitySelections();
  }
}
function renderAmbiguitySelections(){
  const box=$("#ambiguityTuples"); if(!box)return;
  box.innerHTML=ambiguitySelections.length
    ? ambiguitySelections.map((x,i)=>`<div class="ambiguity-tuple"><code>(${esc(x.article)}, ${esc(x.word)})</code><button type="button" data-remove-tuple="${i}" aria-label="Remove ${esc(x.word)}">×</button></div>`).join("")
    : '<span class="muted">No words selected yet.</span>';
  box.querySelectorAll("[data-remove-tuple]").forEach(b=>b.addEventListener("click",()=>{
    ambiguitySelections.splice(+b.dataset.removeTuple,1); renderAmbiguitySelections();
  }));
}
function captureAbstractSelection(p){
  const sel=window.getSelection();
  if(!sel || sel.isCollapsed) return;
  if(!p.contains(sel.anchorNode) || !p.contains(sel.focusNode)) return;
  const phrase=sel.toString();
  addAmbiguitySelection(p.dataset.abstractId,phrase);
  sel.removeAllRanges();
}
function wireAmbiguityCollector(root=document){
  ensureAmbiguityPanel();
  root.querySelectorAll(".selectable-abstract").forEach(p=>{
    if(p.dataset.ambiguityWired)return;
    p.dataset.ambiguityWired="1";
    p.addEventListener("mouseup",()=>setTimeout(()=>captureAbstractSelection(p),0));
    p.addEventListener("dblclick",()=>setTimeout(()=>captureAbstractSelection(p),0));
  });
}
async function submitAmbiguitySelections(){
  if(!ambiguitySelections.length){alert("Select at least one word or phrase from an abstract first.");return;}
  const discipline=$("#ambiguityDiscipline").value.trim();
  if(!discipline){alert("Please select your discipline.");$("#ambiguityDiscipline").focus();return;}
  const comment=$("#ambiguityComment").value.trim();
  const button=$("#submitAmbiguity"), status=$("#ambiguityStatus");
  const payload={discipline,comment,selections:ambiguitySelections.map(x=>({article:x.article,word:x.word}))};
  button.disabled=true; button.textContent="Submitting…";
  status.className="submission-status"; status.textContent="";
  try{
    const response=await fetch("/api/feedback",{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(payload)
    });
    if(!response.ok) throw new Error("Submission service returned "+response.status);
    const result=await response.json();
    if(!result.success) throw new Error(result.error||"Submission failed.");
    const n=result.termsSubmitted||ambiguitySelections.length;
    status.className="submission-status success";
    status.textContent=`Thank you. ${n} terminology suggestion${n===1?" was":"s were"} submitted successfully.`;
    ambiguitySelections=[]; renderAmbiguitySelections();
    $("#ambiguityComment").value="";
  }catch(err){
    console.error(err);
    status.className="submission-status error";
    status.textContent="The suggestions could not be submitted. Please try again.";
  }finally{
    button.disabled=false; button.textContent="Submit suggestions";
  }
}

let dashCategory="all";
function initDashboard(){
  const ds=DATA.meta.disciplineDashboard.disciplines;
  $("#discA").innerHTML=ds.map(d=>`<option>${esc(d)}</option>`).join("");
  $("#discB").innerHTML=ds.map(d=>`<option>${esc(d)}</option>`).join("");
  $("#discA").value="Data Scientist / Statistician"; $("#discB").value="Epidemiologist";
  $("#discA").addEventListener("change",renderDashboard); $("#discB").addEventListener("change",renderDashboard);
  $("#dashMethod").textContent="Exploratory classification: "+DATA.meta.disciplineDashboard.method;
  renderDashboard();
}
function classifyForPair(t,a,b){
  const fa=t.disciplineFamiliarity?.[a]||1, fb=t.disciplineFamiliarity?.[b]||1;
  // Corpus-level meaning variation takes priority because familiar words can still be semantically risky.
  if(t.semanticAmbiguity && fa>=2 && fb>=2) return "amb";
  if(fa>=2 && fb>=2) return "shared";
  if(fa<2 && fb>=2) return "a";
  if(fa>=2 && fb<2) return "b";
  return "amb";
}
function renderDashboard(){
  const a=$("#discA").value,b=$("#discB").value;
  const cats={shared:[],a:[],b:[],amb:[]};
  DATA.terms.forEach(t=>cats[classifyForPair(t,a,b)].push(t));
  const labels={shared:"Shared",a:`May need explanation for ${a}`,b:`May need explanation for ${b}`,amb:"Potentially ambiguous to both"};
  const cls={shared:"cat-shared",a:"cat-a",b:"cat-b",amb:"cat-amb"};
  $("#dashSummary").innerHTML=`<button class="metric metric-button ${dashCategory==="all"?"selected":""}" data-cat="all"><b>${DATA.terms.length}</b><span>All terms</span></button>`+Object.keys(cats).map(k=>`<button class="metric metric-button ${cls[k]} ${dashCategory===k?"selected":""}" data-cat="${k}"><b>${cats[k].length}</b><span>${esc(labels[k])}</span></button>`).join("");
  $$("#dashSummary .metric-button").forEach(x=>x.addEventListener("click",()=>{dashCategory=x.dataset.cat;renderDashboard()}));
  $("#dashBar").innerHTML=Object.keys(cats).map(k=>{const pct=Math.round(cats[k].length/DATA.terms.length*100);return `<div class="bar-row"><div class="bar-label"><span>${esc(labels[k])}</span><b>${pct}%</b></div><div class="bar-track"><div class="bar-fill ${cls[k]}" style="width:${pct}%"></div></div></div>`}).join("");
  $("#dashLegend").innerHTML=`<div class="selected-category"><b>${dashCategory==="all"?"All terms":esc(labels[dashCategory])}</b><span>${dashCategory==="all"?DATA.terms.length:cats[dashCategory].length} terms</span></div>`;
  const shown=dashCategory==="all"?[...DATA.terms]:[...cats[dashCategory]];
  $("#dashTermList").innerHTML=shown.sort((x,y)=>x.term.localeCompare(y.term)).map(t=>`<button class="term-chip" data-id="${t.id}">${esc(t.term)}</button>`).join("");
  $$("#dashTermList .term-chip").forEach(x=>x.addEventListener("click",()=>{const id=+x.dataset.id;captureTermOrigin(x);switchView("dictionary");$("#q").value="";$("#domain").value="";$("#varies").value="";renderDictionary();selectTerm(id);document.querySelector(`#results .term-row[data-id="${id}"]`)?.scrollIntoView({behavior:"smooth",block:"center"})}));
}
let networkReturnPosition=null;
function returnToNetwork(){
  switchView("network");
  if(networkReturnPosition!==null) requestAnimationFrame(()=>window.scrollTo({top:networkReturnPosition,behavior:"auto"}));
  $("#networkBackButton").hidden=true;
  $$("#abstractList .network-article-back").forEach(b=>b.hidden=true);
}
function openNetworkAbstract(abstractId){
  networkReturnPosition=window.scrollY;
  $("#networkBackButton").hidden=true;
  $$("#abstractList .network-article-back").forEach(b=>b.hidden=true);
  // Clear the Abstracts keyword filter so the destination cannot remain hidden.
  const search=$("#abstractKeywordFilter");
  if(search)search.value="";
  abstractDomainSelection="";
  streamAbstractSelection=null;
  renderAbstractDomainFilter();
  filterAbstracts();
  switchView("abstracts");
  const cards=$$("#abstractList .abstract-card");
  const target=cards.find(card=>card.dataset.articleId===String(abstractId).padStart(2,"0"));
  if(target){
    target.hidden=false;
    const details=target.querySelector(".abstract-collapse");
    if(details) details.open=true;
    const back=target.querySelector(".network-article-back");
    if(back) back.hidden=false;
    requestAnimationFrame(()=>target.scrollIntoView({behavior:"smooth",block:"start"}));
  }
}
let networkShowTerms=false;
function renderNetwork(){
  const svg=$("#networkSvg"); svg.innerHTML="";
  $("#networkShowTerms").checked=networkShowTerms;
  const terms=DATA.terms.filter(t=>t.count>1||t.varies).slice(0,70);
  const field=networkLevel===1?"domainLevel1":"domain";
  const domains=[...new Set(terms.map(t=>t[field]))];
  // Ignore unlinked terminology records: a blank abstractId previously created a spurious "A" node.
  const validAbstractIds=new Set(DATA.abstracts.map(a=>String(a["Abstract ID"]).padStart(2,"0")));
  const abstracts=[...new Set(terms.flatMap(t=>t.occurrences.map(o=>String(o.abstractId||"").padStart(2,"0"))).filter(id=>validAbstractIds.has(id)))];
  // Scale vertical space to the number of nodes rather than squeezing all nodes into 620px.
  const height=Math.max(1100,domains.length*74+140,abstracts.length*48+140,networkShowTerms?Math.ceil(terms.length/3)*86+140:0);
  svg.setAttribute("viewBox",`0 0 ${networkShowTerms?1250:920} ${height}`);
  svg.style.height=height+"px";
  svg.style.minWidth=networkShowTerms?"1500px":"1000px";
  const distribute=(i,n,margin=65)=>margin+(n<=1?(height-2*margin)/2:i*(height-2*margin)/(n-1));
  const nodes=[];
  domains.forEach((d,i)=>nodes.push({id:"d"+i,label:d,type:"domain",x:245,y:distribute(i,domains.length)}));
  abstracts.forEach((a,i)=>nodes.push({id:"a"+a,label:"A"+a,abstractId:String(a).padStart(2,"0"),type:"abstract",x:networkShowTerms?1120:780,y:distribute(i,abstracts.length)}));
  if(networkShowTerms) terms.forEach((t,i)=>nodes.push({id:"t"+t.id,label:t.term,type:"term",termId:t.id,x:515+(i%3)*125,y:distribute(Math.floor(i/3),Math.ceil(terms.length/3))}));
  const byId=Object.fromEntries(nodes.map(n=>[n.id,n])), dId=Object.fromEntries(domains.map((d,i)=>[d,"d"+i]));
  const edges=[], edgeKeys=new Set();
  const addEdge=(a,b)=>{const key=a+"|"+b;if(!edgeKeys.has(key)){edgeKeys.add(key);edges.push([a,b]);}};
  terms.forEach(t=>{
    if(networkShowTerms){addEdge(dId[t[field]],"t"+t.id);t.occurrences.forEach(o=>{const aid=String(o.abstractId||"").padStart(2,"0");if(validAbstractIds.has(aid))addEdge("t"+t.id,"a"+aid);});}
    else t.occurrences.forEach(o=>{const aid=String(o.abstractId||"").padStart(2,"0");if(validAbstractIds.has(aid))addEdge(dId[t[field]],"a"+aid);});
  });
  const NS="http://www.w3.org/2000/svg", edgeEls=[], nodeEls=[];
  edges.forEach(([a,b])=>{if(!byId[a]||!byId[b])return;let l=document.createElementNS(NS,"line");l.setAttribute("x1",byId[a].x);l.setAttribute("y1",byId[a].y);l.setAttribute("x2",byId[b].x);l.setAttribute("y2",byId[b].y);l.setAttribute("class","edge");l.dataset.a=a;l.dataset.b=b;svg.appendChild(l);edgeEls.push(l)});
  nodes.forEach(n=>{
    let g=document.createElementNS(NS,"g");g.setAttribute("class","node");g.dataset.id=n.id;g.setAttribute("tabindex","0");g.setAttribute("role",n.type==="abstract"?"link":"button");g.setAttribute("aria-label",n.type==="abstract"?"Open Abstract "+n.abstractId:n.type+" "+n.label);
    let c=document.createElementNS(NS,"circle");c.setAttribute("cx",n.x);c.setAttribute("cy",n.y);c.setAttribute("r",n.type==="domain"?9:n.type==="term"?6:7);c.setAttribute("class","node-"+n.type);g.appendChild(c);
    let tx=document.createElementNS(NS,"text");tx.setAttribute("x",n.x+(n.type==="domain"?-16:16));tx.setAttribute("text-anchor",n.type==="domain"?"end":"start");tx.setAttribute("y",n.y-12);tx.setAttribute("class","label");tx.textContent=n.label.length>34?n.label.slice(0,32)+"…":n.label;g.appendChild(tx);if(n.type==="abstract")g.classList.add("abstract-link-node");svg.appendChild(g);nodeEls.push(g);
    const pick=()=>n.type==="abstract"?openNetworkAbstract(n.abstractId):highlight(n);
    g.addEventListener("click",e=>{e.stopPropagation();pick()});
    g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick()}});
  });
  function highlight(n){
    const connected=new Set([n.id]); edgeEls.forEach(e=>{if(e.dataset.a===n.id)connected.add(e.dataset.b);if(e.dataset.b===n.id)connected.add(e.dataset.a)});
    edgeEls.forEach(e=>{const hit=e.dataset.a===n.id||e.dataset.b===n.id;e.classList.toggle("hit",hit);e.classList.toggle("dim",!hit)});
    nodeEls.forEach(g=>{const hit=connected.has(g.dataset.id);g.classList.toggle("hit",hit);g.classList.toggle("dim",false);g.classList.toggle("selected-node",g.dataset.id===n.id);const lab=g.querySelector(".label");if(lab){lab.classList.toggle("hit",hit);lab.classList.toggle("dim",false)}});
    const connectedNodes=[...connected].filter(x=>x!==n.id).map(x=>byId[x]?.label).filter(Boolean);
    $("#networkStatus").textContent=`Selected ${n.type}: ${n.label}. ${connectedNodes.length} direct connection${connectedNodes.length===1?"":"s"} highlighted.`;
    if(n.type==="term"&&n.termId){selected=DATA.terms.find(t=>t.id===n.termId)}
  }
  svg.addEventListener("click",()=>{edgeEls.forEach(e=>e.classList.remove("hit","dim"));nodeEls.forEach(g=>{g.classList.remove("hit","dim","selected-node");const lab=g.querySelector(".label");if(lab)lab.classList.remove("hit","dim")});$("#networkStatus").textContent="No node selected."});
}
$("#networkShowTerms").addEventListener("change",e=>{networkShowTerms=e.target.checked;renderNetwork();});
$("#networkBackButton").addEventListener("click",returnToNetwork);
document.addEventListener("click",e=>{if(e.target.closest(".network-article-back")) returnToNetwork();});
init().catch(e=>{document.body.innerHTML="<p style='padding:20px'>Could not load the terminology data. If opening locally, serve this folder with a small HTTP server (see README).</p>"});

// Research Streams navigation: handbook sections and interpretative groups remain distinct.
const STREAM_GROUP_IDS=[[3,17,22,24,26,27,44,45,46],[1,2,3,4,5,6,7,8,21,23,25],[9,12,14,15,16,18,19,20,21,30],[32,33,34,35,36,37,38,39],[11,29,30,31,32]];
function openStreamSection(section){
  streamAbstractSelection=null;
  abstractDomainLevel=2;
  abstractDomainSelection=section;
  const search=document.querySelector("#abstractKeywordFilter");if(search)search.value="";
  renderAbstractDomainFilter();filterAbstracts();switchView("abstracts");
  document.querySelector("#abstractDomainGrid")?.scrollIntoView({block:"start"});
}
function openStreamGroup(group){
  const ids=STREAM_GROUP_IDS[group];if(!ids)return;
  abstractDomainSelection="";
  streamAbstractSelection=new Set(ids.map(id=>String(id).padStart(2,"0")));
  const search=document.querySelector("#abstractKeywordFilter");if(search)search.value="";
  renderAbstractDomainFilter();filterAbstracts();switchView("abstracts");
  document.querySelector("#abstractList")?.scrollIntoView({block:"start"});
}
function openStreamAbstract(id){
  const aid=String(id).padStart(2,"0");
  const a=DATA?.abstracts?.find(item=>String(item["Abstract ID"]).padStart(2,"0")===aid);
  if(!a)return;
  const dialog=document.querySelector("#streamAbstractDialog");
  const content=document.querySelector("#streamDialogContent");
  if(!dialog||!content)return;
  const abstractHTML=termLinkHTML(a.actualAbstract||"Abstract text was not recovered from the supplied PDF.",aid)
    .replace(/\b(KEYWORDS|INTRODUCTION|BACKGROUND|AIM|OBJECTIVE|METHODS|RESULTS|DISCUSSION|CONCLUSION)\b/g,'<strong class="section-label">$1</strong>');
  content.innerHTML=`<h3>Abstract ${esc(aid)}: ${esc(a["Abstract title"])}</h3>
    <p class="stream-dialog-meta">${esc(a["Section"])} · PDF page ${esc(a["PDF page"])}</p>
    <p class="stream-dialog-authors">${a.authors?`<strong>Authors:</strong> ${esc(a.authors)}`:`<strong>Presenting author:</strong> ${esc(a.presentingAuthor||"Not available")}`}</p>
    <div class="actual-abstract"><h4>Abstract</h4><p class="linked-text">${abstractHTML}</p></div>`;
  wireDictionaryLinks(content);
  if(!dialog.open)dialog.showModal();
  dialog.querySelector("#closeStreamDialog")?.focus();
}
document.querySelector("#closeStreamDialog")?.addEventListener("click",()=>document.querySelector("#streamAbstractDialog")?.close());
document.querySelector("#streamAbstractDialog")?.addEventListener("click",e=>{if(e.target===e.currentTarget)e.currentTarget.close();});
document.querySelectorAll("[data-stream-section]").forEach(el=>el.addEventListener("click",()=>openStreamSection(el.dataset.streamSection)));
document.querySelectorAll("[data-stream-group]").forEach(el=>el.addEventListener("click",()=>openStreamGroup(Number(el.dataset.streamGroup))));
document.querySelectorAll("[data-stream-abstract]").forEach(el=>el.addEventListener("click",()=>openStreamAbstract(el.dataset.streamAbstract)));
