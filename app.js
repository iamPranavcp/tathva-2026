(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const labels = {hero:'Featured carousel',side1:'Upcoming events 01',side2:'Upcoming events 02',side3:'Upcoming events 03',venues:'Venues & live events'};
  let site, activeKey='hero', heroIndex=0, timers=[], progressFrame, saveTimer;
  const overlay=$('#cms-overlay'), toast=$('#toast');
  const defaultImage='https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=85';
  async function loadSite(){const r=await fetch('/api/site');site=await r.json();renderSite();}
  function mediaNode(slide, cls=''){
    if(slide.type==='video'){const v=document.createElement('video');v.src=slide.src;v.autoplay=true;v.muted=true;v.playsInline=true;v.loop=false;v.className=cls;v.setAttribute('aria-label',slide.title||'Featured video');return v;}
    const img=document.createElement('img');img.src=slide.src||defaultImage;img.alt=slide.title||'Event gallery';img.loading='lazy';img.className=cls;return img;
  }
  function renderSite(){
    if(!site)return;
    $('#featured-heading').innerHTML=`${escapeHTML(site.settings.featuredTitle||'Featured events')} <span>&amp; partners</span><i>↗</i>`;
    $('#hero-stage').replaceChildren();
    $('.hero-card').classList.toggle('clean-media',site.settings.heroOverlay===false);
    const hero=site.carousels.hero||[]; heroIndex=hero.length?heroIndex%hero.length:0;
    if(hero.length){$('#hero-stage').append(mediaNode(hero[heroIndex]));$('#hero-title').textContent=hero[heroIndex].title;$('#hero-subtitle').textContent=hero[heroIndex].subtitle||'';$('#hero-tag').textContent=hero[heroIndex].tag||'TATHVA 2026 · PARTNERS';$('#hero-counter').innerHTML=`${String(heroIndex+1).padStart(2,'0')} <i>/</i> ${String(hero.length).padStart(2,'0')}`;$('#hero-copy')?.classList.remove('empty');}
    else {$('#hero-stage').innerHTML=`<div class="empty-hero"><span>✳</span><b>Your next big story<br/>starts here.</b><small>Open Manage to add a featured slide.</small></div>`;$('#hero-title').textContent='Your next big story starts here';$('#hero-subtitle').textContent='Open Manage to add a featured slide.';$('#hero-tag').textContent='YOUR CITY, YOUR STORIES';$('#hero-counter').innerHTML='00 <i>/</i> 00';}
    const dots=$('#hero-dots');dots.replaceChildren(...hero.map((_,i)=>{const b=document.createElement('button');b.className=i===heroIndex?'active':'';b.setAttribute('aria-label',`Go to featured slide ${i+1}`);b.onclick=()=>showHero(i);return b;}));
    renderUpcoming();
    renderVenues();
    const ticker=escapeHTML(site.settings.ticker||'HELLO TATHVA 2026');$$('.ticker-track span').forEach(n=>n.textContent=ticker);
    clearTimers();startAutoplay();
  }
  function renderUpcoming(){
    const root=$('#upcoming-list');if(!root)return;
    const events=['side1','side2','side3'].flatMap(key=>(site.carousels[key]||[]).map((slide,position)=>({slide,key,position}))).filter(({slide})=>String(slide.title||'').trim());
    events.sort((a,b)=>Number(Boolean(b.slide.priority))-Number(Boolean(a.slide.priority)));
    const priority=events.find(({slide})=>slide.priority);
    $('#upcoming-count').textContent=`${String(events.length).padStart(2,'0')} ${events.length===1?'EVENT':'EVENTS'}`;
    root.replaceChildren(...(events.length?events.map(({slide},index)=>{
      const featured=Boolean(priority&&slide===priority.slide),card=document.createElement('article');
      card.className=`upcoming-event${featured?' priority-event':''}`;
      const marker=document.createElement('span');marker.className='event-marker';marker.textContent=featured?'PRIORITY':`EVENT ${String(index+1).padStart(2,'0')}`;card.append(marker);
      const title=document.createElement('h3');title.textContent=slide.title;card.append(title);
      const meta=String(slide.meta||slide.tag||'').trim();
      if(meta){const when=document.createElement('p');when.className='event-meta';when.textContent=meta;card.append(when);}
      const details=String(slide.details||slide.subtitle||'').trim();
      const description=document.createElement('p');description.className='event-details';description.textContent=details||'More details coming soon.';card.append(description);
      return card;
    }):[Object.assign(document.createElement('p'),{className:'upcoming-empty',textContent:'Upcoming events will be announced soon.'})]));
    $('#upcoming-notice-text').textContent=String(site.settings.upcomingNotice||'More event details are coming soon.');
  }
  function renderVenues(){
    const root=$('#venue-grid');if(!root)return;const venues=site.venues||[];
    root.replaceChildren(...venues.map((venue,i)=>{const card=document.createElement('article');card.className='venue-card';card.style.setProperty('--venue-image',`url("${String(venue.image||'').replace(/["\\]/g,'')}")`);card.innerHTML=`<div class="venue-image"></div><div class="venue-card-top"><span><b></b>${escapeHTML(venue.status==='HAPPENING NOW'?'LIVE':venue.status||'LIVE')}</span><small>0${i+1}</small></div><div class="venue-content"><p class="venue-area">${escapeHTML(venue.area)}</p><h3>${escapeHTML(venue.name)}</h3><div class="venue-event"><strong>${escapeHTML(venue.event)}</strong><p>${escapeHTML(venue.detail)}</p></div><div class="venue-time"><span>UNTIL</span><b>${escapeHTML(venue.time)}</b></div></div>`;return card;}));
    if(!venues.length){root.innerHTML='<p class="no-venues">No live venues at the moment. Check back soon.</p>';}
  }
  function escapeHTML(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function clearTimers(){timers.forEach(clearTimeout);timers=[];cancelAnimationFrame(progressFrame);}
  function showHero(index){const slides=site.carousels.hero;if(!slides.length)return;heroIndex=(index+slides.length)%slides.length;renderSite();}
  function startAutoplay(){const hero=site.carousels.hero;if(hero.length>1){const duration=Math.max(3,Number(hero[heroIndex].duration||site.settings.interval||6))*1000;const start=performance.now();const tick=(t)=>{const f=$('#hero-progress-fill');if(!f)return;f.style.width=`${Math.min(100,(t-start)/duration*100)}%`;if(t-start<duration)progressFrame=requestAnimationFrame(tick);};progressFrame=requestAnimationFrame(tick);timers.push(setTimeout(()=>showHero(heroIndex+1),duration));}}
  $('#hero-next').onclick=()=>showHero(heroIndex+1);$('#hero-prev').onclick=()=>showHero(heroIndex-1);
  $('#cms-close').onclick=closeCMS;overlay.addEventListener('click',e=>{if(e.target===overlay)closeCMS();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)closeCMS();if(e.key==='ArrowRight'&&overlay.hidden)showHero(heroIndex+1);if(e.key==='ArrowLeft'&&overlay.hidden)showHero(heroIndex-1);});
  const adminRoute=location.pathname==='/admin'||location.pathname==='/admin/';
  if(adminRoute){document.body.classList.add('admin-page');const robots=document.createElement('meta');robots.name='robots';robots.content='noindex,nofollow,noarchive';document.head.append(robots);openCMS();}
  function openCMS(key='hero'){overlay.hidden=false;document.body.style.overflow='hidden';activeKey=key;refreshEditor();$('#cms-password').focus();}
  function closeCMS(){if(adminRoute){location.assign('/');return;}overlay.hidden=true;document.body.style.overflow='';}
  async function revealEditor(){ $('#login-view').hidden=true;$('#editor-view').hidden=false;refreshEditor(); }
  $('#login-form').onsubmit=async e=>{e.preventDefault();const error=$('#login-error');error.textContent='';const button=e.currentTarget.querySelector('button');button.disabled=true;try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#cms-password').value})});const data=await r.json();if(!r.ok)throw new Error(data.error);await revealEditor();}catch(err){error.textContent=err.message;}finally{button.disabled=false;}};
  $('#logout').onclick=async()=>{await fetch('/api/logout',{method:'POST'});$('#editor-view').hidden=true;$('#login-view').hidden=false;$('#cms-password').value='';};
  $$('.editor-tab').forEach(tab=>tab.onclick=()=>{activeKey=tab.dataset.key;refreshEditor();});
  function refreshEditor(){
    $$('.editor-tab').forEach(t=>t.classList.toggle('active',t.dataset.key===activeKey));$('#editor-section-name').textContent=labels[activeKey];$('#ticker-input').value=site?.settings.ticker||'';$('#upcoming-notice-input').value=site?.settings.upcomingNotice||'';$('#interval-input').value=site?.settings.interval||6;
    const venueMode=activeKey==='venues';$('#add-slide').hidden=venueMode;$('#add-slide').textContent=activeKey==='hero'?'＋ Add slide':'＋ Add event';$('#slide-editor-list').hidden=venueMode;$('#venue-editor-list').hidden=!venueMode;$('#hero-overlay-setting').hidden=activeKey!=='hero';$('#hero-overlay-toggle').checked=site?.settings.heroOverlay!==false;
    if(venueMode){$('#venue-editor-list').replaceChildren(...(site?.venues||[]).map((venue,i)=>venueEditor(venue,i)));const add=document.createElement('button');add.className='add-venue';add.textContent='＋ Add venue';add.onclick=()=>{site.venues.push({id:`venue-${crypto.randomUUID()}`,name:'New venue',area:'Kochi',event:'New event',detail:'Event type · Venue area',time:'Until 10:00 PM',status:'HAPPENING NOW',image:defaultImage});refreshEditor();$('#venue-editor-list').lastElementChild?.scrollIntoView({behavior:'smooth',block:'center'});};$('#venue-editor-list').append(add);}
    else {const list=site?.carousels[activeKey]||[];const root=$('#slide-editor-list');root.replaceChildren(...list.map((slide,i)=>slideEditor(slide,i)));}
    $('#save-status').textContent='Changes are saved to your site.';
  }
  function venueEditor(venue,index){const card=document.createElement('div');card.className='venue-editor';card.innerHTML=`<div class="venue-editor-top"><div><b>${escapeHTML(venue.name)}</b><span>${escapeHTML(venue.event)} · ${escapeHTML(venue.area)}</span></div><button type="button" class="remove-slide">Remove</button></div><div class="venue-fields"><label>Venue name<input data-field="name" value="${escapeHTML(venue.name)}" maxlength="70"></label><label>Area / neighbourhood<input data-field="area" value="${escapeHTML(venue.area)}" maxlength="60"></label><label>Event happening now<input data-field="event" value="${escapeHTML(venue.event)}" maxlength="80"></label><label>Event detail<input data-field="detail" value="${escapeHTML(venue.detail)}" maxlength="100"></label><label>Running until<input data-field="time" value="${escapeHTML(venue.time)}" maxlength="40"></label><label>Status label<input data-field="status" value="${escapeHTML(venue.status)}" maxlength="30"></label><label class="wide">Venue image URL<input data-field="image" value="${escapeHTML(venue.image)}" placeholder="https://…"></label><div class="venue-image-upload wide"><label class="upload-button">Upload image<input type="file" accept="image/jpeg,image/png,image/webp"></label><span>Mobile: 4:5 · 1080 × 1350 px recommended · JPG, PNG or WebP · up to 8 MB</span></div></div>`;$$('[data-field]',card).forEach(input=>input.oninput=()=>{venue[input.dataset.field]=input.value;if(input.dataset.field==='name'||input.dataset.field==='event'||input.dataset.field==='area'){const top=card.querySelector('.venue-editor-top');top.querySelector('b').textContent=venue.name;top.querySelector('span').textContent=`${venue.event} · ${venue.area}`;}});$('input[type=file]',card).onchange=async e=>{const file=e.target.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){notify('Choose a JPG, PNG, or WebP image.');return;}if(file.size>8*1024*1024){notify('Images must be 8 MB or smaller.');return;}const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});try{const r=await fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data})});const out=await r.json();if(!r.ok)throw new Error(out.error);venue.image=out.src;refreshEditor();notify('Venue image uploaded. Publish changes to make it live.');}catch(err){notify(err.message);}};$('.remove-slide',card).onclick=()=>{site.venues.splice(index,1);refreshEditor();};return card;}
  function slideEditor(slide,index){
    const isHero=activeKey==='hero',card=document.createElement('div');card.className=`slide-editor${isHero?'':' event-slide-editor'}`;const summary=document.createElement('div');summary.className='slide-summary';
    if(isHero){const img=document.createElement('img');img.className='slide-thumb';img.src=slide.src||defaultImage;img.alt='';summary.append(img);}else{const marker=document.createElement('span');marker.className='event-editor-marker';marker.textContent=slide.priority?'★':'EVENT';summary.append(marker);}
    const copy=document.createElement('div');copy.className='slide-summary-copy';copy.innerHTML=isHero?`<b>${escapeHTML(slide.title||'New slide')}</b><span>${slide.type==='video'?'VIDEO':'IMAGE'} · ${Number(slide.duration||6)} SEC</span>`:`<b>${escapeHTML(slide.title||'New event')}</b><span>${escapeHTML(slide.meta||slide.tag||'Event details to add')}</span>`;summary.append(copy);
    const actions=document.createElement('div');actions.className='slide-actions';if(index>0){const up=document.createElement('button');up.textContent='↑';up.setAttribute('aria-label','Move slide up');up.onclick=()=>moveSlide(index,-1);actions.append(up);}if(index<site.carousels[activeKey].length-1){const down=document.createElement('button');down.textContent='↓';down.setAttribute('aria-label','Move slide down');down.onclick=()=>moveSlide(index,1);actions.append(down);}const remove=document.createElement('button');remove.className='remove-slide';remove.textContent='Remove';remove.onclick=()=>{site.carousels[activeKey].splice(index,1);refreshEditor();};actions.append(remove);summary.append(actions);card.append(summary);
    const eventFields=`<label class="wide">Event title<input data-field="title" value="${escapeHTML(slide.title||'')}" maxlength="90" /></label><label class="wide">Date, time or venue<input data-field="meta" value="${escapeHTML(slide.meta||slide.tag||'')}" maxlength="100" placeholder="Date · Time · Venue" /></label><label class="wide">Event details<input data-field="details" value="${escapeHTML(slide.details||slide.subtitle||'')}" maxlength="140" placeholder="Short details for visitors" /></label><label class="priority-choice wide"><input data-field="priority" type="checkbox" ${slide.priority?'checked':''}><span>Feature as the priority event</span></label>`;
    const heroFields=`<label>Slide title<input data-field="title" value="${escapeHTML(slide.title||'')}" maxlength="90" /></label><label>Media type<select data-field="type"><option value="image" ${slide.type==='image'?'selected':''}>Image</option><option value="video" ${slide.type==='video'?'selected':''}>Video (featured only)</option></select></label><label class="wide">Image or video URL<div class="upload-row"><input data-field="src" value="${escapeHTML(slide.src||'')}" placeholder="https://…"/><label>Upload<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" /></label></div></label><small class="media-help wide">Featured media: 1820 × 1080 px (1.685:1). Images crop responsively on smaller screens.</small><label class="wide">Short description<input data-field="subtitle" value="${escapeHTML(slide.subtitle||'')}" maxlength="140" /></label><label class="wide">Eyebrow label<input data-field="tag" value="${escapeHTML(slide.tag||'')}" maxlength="50" /></label><label>On screen for <small>(seconds)</small><input data-field="duration" type="number" min="3" max="120" value="${Number(slide.duration||6)}" /></label>`;
    const fields=document.createElement('div');fields.className='slide-fields';fields.innerHTML=isHero?heroFields:eventFields;card.append(fields);
    $$('[data-field]',fields).forEach(el=>el.addEventListener(el.type==='checkbox'?'change':'input',()=>{
      if(el.dataset.field==='priority'){
        slide.priority=el.checked;
        if(el.checked)for(const key of ['side1','side2','side3'])for(const event of site.carousels[key]||[])if(event!==slide)event.priority=false;
        refreshEditor();return;
      }
      if(el.dataset.field==='duration')slide.duration=Math.max(3,Number(el.value)||6);else slide[el.dataset.field]=el.value;
      if(el.dataset.field==='type')refreshEditor();else if(el.dataset.field==='title')copy.querySelector('b').textContent=el.value||(isHero?'New slide':'New event');else if(el.dataset.field==='meta'&&!isHero)copy.querySelector('span').textContent=el.value||'Event details to add';
    }));
    const fileInput=$('input[type=file]',fields);if(fileInput)fileInput.onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>8*1024*1024){notify('Files need to be 8 MB or smaller.');return;}const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});try{const r=await fetch('/api/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data})});const out=await r.json();if(!r.ok)throw new Error(out.error);slide.src=out.src;slide.type=out.type;refreshEditor();notify('Media added to your library.');}catch(err){notify(err.message);}};
    return card;
  }
  function moveSlide(index,direction){const list=site.carousels[activeKey],target=index+direction;[list[index],list[target]]=[list[target],list[index]];refreshEditor();}
  $('#add-slide').onclick=()=>{site.carousels[activeKey].push(activeKey==='hero'?{id:`slide-${crypto.randomUUID()}`,title:'New story',subtitle:'',tag:'TATHVA 2026',type:'image',src:defaultImage,duration:Number(site.settings.interval||6)}:{id:`event-${crypto.randomUUID()}`,title:'New event',details:'',meta:'',priority:false});refreshEditor();$('#slide-editor-list').lastElementChild?.scrollIntoView({behavior:'smooth',block:'center'});};
  $('#ticker-input').oninput=e=>site.settings.ticker=e.target.value;$('#upcoming-notice-input').oninput=e=>site.settings.upcomingNotice=e.target.value;$('#interval-input').oninput=e=>site.settings.interval=Math.max(3,Math.min(120,Number(e.target.value)||6));
  $('#hero-overlay-toggle').onchange=e=>{site.settings.heroOverlay=e.target.checked;$('.hero-card').classList.toggle('clean-media',!e.target.checked);};
  $('#save-site').onclick=async()=>{const status=$('#save-status');status.textContent='Publishing…';const button=$('#save-site');button.disabled=true;try{const r=await fetch('/api/site',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(site)});const data=await r.json();if(!r.ok)throw new Error(data.error);status.textContent='Published just now';renderSite();notify('Your updates are live.');}catch(err){status.textContent=err.message;notify(err.message);}finally{button.disabled=false;}};
  function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(saveTimer);saveTimer=setTimeout(()=>toast.classList.remove('show'),2600);}
  loadSite().catch(()=>notify('Could not load site content. Check your connection and refresh.'));
})();
