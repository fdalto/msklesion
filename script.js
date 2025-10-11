// script.js — versão atualizada conforme pedido
// Simulação frontend → backend; BAMIC e SCORE exibidos com mesma ênfase.
// Nota: campos "Idade" e "Observações" foram removidos.

(function () {
  const qs = id => document.getElementById(id);

  // inputs
  const muscle = qs('muscle');
  const mechanism = qs('mechanism');
  const segment = qs('segment');
  const anatomic = qs('anatomic');
  const volumePercent = qs('volumePercent');
  const volumePercentLabel = qs('volumePercentLabel');
  const edemaLength = qs('edemaLength');
  const ruptureGap = qs('ruptureGap');
  const mlgr = qs('mlgr');
  const tendonInvolvement = qs('tendonInvolvement');
  const completeTear = qs('completeTear');
  const reinjury = qs('reinjury');
  const apiEndpoint = qs('apiEndpoint');

  // buttons + outputs
  const btnCalc = qs('btnCalc');
  const btnSend = qs('btnSend');
  const jsonOut = qs('jsonOut');
  const apiOut = qs('apiOut');
  const scoreDisplay = qs('scoreDisplay');
  const bamicDisplay = qs('bamicDisplay');
  const processingArea = qs('processingArea');
  const rtpDisplay = qs('rtpDisplay');
  const varsTableBody = qs('varsTable').querySelector('tbody');
  const bamicSimNote = qs('bamicSimNote');

  // helper
  function selCodeAndLabel(selectEl) {
    const code = Number(selectEl.value);
    const label = selectEl.options[selectEl.selectedIndex].text;
    return { code, label };
  }

  function buildPayload() {
    const muscleSel = selCodeAndLabel(muscle);
    const mechSel = selCodeAndLabel(mechanism);
    const segSel = selCodeAndLabel(segment);
    const anatSel = selCodeAndLabel(anatomic);
    const mlgrSel = selCodeAndLabel(mlgr);
    const tendonSel = selCodeAndLabel(tendonInvolvement);
    const completeTearSel = selCodeAndLabel(completeTear);
    const reinjurySel = selCodeAndLabel(reinjury);

    return {
      muscle: { code: muscleSel.code, label: muscleSel.label },
      mechanism: { code: mechSel.code, label: mechSel.label },
      segment: { code: segSel.code, label: segSel.label },
      anatomic: { code: anatSel.code, label: anatSel.label },
      volume_percent: Number(volumePercent.value || 0),
      edema_length_mm: Number(edemaLength.value || 0),
      rupture_gap_mm: Number(ruptureGap.value || 0),
      mlgr: { code: mlgrSel.code, label: mlgrSel.label },
      tendon_involvement: { code: tendonSel.code, label: tendonSel.label },
      complete_tear: { code: completeTearSel.code, label: completeTearSel.label },
      reinjury_last6mo: { code: reinjurySel.code, label: reinjurySel.label },
      timestamp: new Date().toISOString()
    };
  }

  // scoring heuristics (idem versão anterior, com normalização)
  function scoreFromPayload(p) {
    let pts = 0;
    const muscleWeights = {
      1: 3.0,2:2.5,3:2.5,4:2.0,5:2.2,6:1.8,7:1.8,8:1.7,9:2.2,10:2.0,11:1.9,12:2.0,13:1.8,14:1.6
    };
    pts += (muscleWeights[p.muscle.code] || 1.5) * 4;

    const mechWeights = {1:5,2:5,3:3,4:2,5:1.5};
    pts += (mechWeights[p.mechanism.code] || 2) * 2;

    const segWeights = {1:4,2:2.5,3:2.0};
    pts += (segWeights[p.segment.code] || 2) * 2;

    const an = {1:1.0,2:2.0,3:3.5,4:4.5};
    pts += (an[p.anatomic.code] || 1) * 3;

    const perc = Math.max(0, Math.min(100, p.volume_percent));
    if (perc <= 5) pts += 1;
    else if (perc <= 25) pts += 3;
    else if (perc <= 50) pts += 6;
    else if (perc <= 75) pts += 9;
    else pts += 12;

    const edemaMm = Math.max(0, Number(p.edema_length_mm || 0));
    pts += Math.min(12, Math.round(edemaMm / 10));

    const gapMm = Math.max(0, Number(p.rupture_gap_mm || 0));
    pts += Math.min(20, Math.round(gapMm / 5));

    pts += (Number(p.mlgr.code) || 0) * 4;
    pts += (Number(p.tendon_involvement.code) || 0) * 5;

    if (p.complete_tear.code === 1) pts += 15;
    else if (p.complete_tear.code === 2) pts += 6;

    if (p.reinjury_last6mo.code === 1) pts += 4;

    // normalize
    const rawMax = 180;
    let score = Math.round((pts / rawMax) * 100);
    score = Math.max(0, Math.min(100, score));
    return { score, rawPoints: pts };
  }

  // BAMIC derivation (heuristic)
  function deriveBAMIC(p) {
    const perc = p.volume_percent;
    if (perc <= 5 && p.complete_tear.code === 0 && p.anatomic.code === 1) {
      return { grade: 0, suffix: '', text: 'Grade 0 (MRI negativo / alteração mínima)' };
    }
    if (p.complete_tear.code === 1 || perc > 60 || p.anatomic.code === 4) {
      const suf = (p.anatomic.code === 4) ? 'c' : (p.anatomic.code === 3) ? 'b' : '';
      return { grade: 4, suffix: suf, text: `Grade 4${suf} (ruptura completa / extenso)` };
    }
    if (perc > 25) {
      const suf = (p.anatomic.code === 3) ? 'b' : (p.anatomic.code === 2) ? 'a' : '';
      return { grade: 3, suffix: suf, text: `Grade 3${suf} (lesão extensa)` };
    }
    if (perc > 5 && perc <= 25) {
      const suf = (p.anatomic.code === 3) ? 'b' : (p.anatomic.code === 2) ? 'a' : '';
      return { grade: 2, suffix: suf, text: `Grade 2${suf} (lesão moderada)` };
    }
    return { grade: 1, suffix: (p.anatomic.code === 2 ? 'a' : ''), text: `Grade 1${p.anatomic.code===2?'a':''} (lesão pequena)` };
  }

  function rtpFromScore(score) {
    if (score <= 15) return { min: 3, max: 7, text: `${3}–${7} dias (retorno esperado curto)` };
    if (score <= 35) return { min: 8, max: 21, text: `${8}–${21} dias (retorno breve)` };
    if (score <= 55) return { min: 22, max: 42, text: `${22}–${42} dias (retorno moderado)` };
    if (score <= 75) return { min: 43, max: 90, text: `${43}–${90} dias (retorno prolongado)` };
    return { min: 90, max: 180, text: `${90}–${180}+ dias (lesão grave / possível intervenção)` };
  }

  function simulateBackend(payload) {
    const derived = scoreFromPayload(payload);
    const bamic = deriveBAMIC(payload);
    const rtp = rtpFromScore(derived.score);

    const baseMs = 600;
    const extra = Math.round((derived.score / 100) * 2000);
    const delay = baseMs + extra + Math.round(Math.random() * 800);

    return new Promise((resolve) => {
      setTimeout(() => {
        const resp = {
          ok: true,
          model: 'simulated-deeplearning-v1',
          score: derived.score,
          rawPoints: derived.rawPoints,
          bamic_grade: `${bamic.grade}${bamic.suffix || ''}`,
          bamic_text: bamic.text,
          rtp_estimate_days: rtp,
          note: 'Resposta gerada por simulação local — integrar backend real para resultados reais.',
          payload_received: payload
        };
        resolve(resp);
      }, delay);
    });
  }

  // UI helpers
  function setProcessing(isProcessing) {
    processingArea.innerHTML = isProcessing ? '<span class="spinner"></span> Processando ...' : '';
  }

  function updateJSONOut(obj) {
    jsonOut.textContent = JSON.stringify(obj, null, 2);
  }

  function updateAPIOut(obj) {
    apiOut.textContent = JSON.stringify(obj, null, 2);
  }

  function escapeHtml(t) {
    return t.replace(/[&<>"'`=\/]/g, function (s) {
      return ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","`":"&#x60;","=":"&#x3D;","/":"&#x2F;"
      })[s];
    });
  }

  function updateVarsTable(payload) {
    const rows = [];
    rows.push(['muscle', payload.muscle.code, payload.muscle.label]);
    rows.push(['mechanism', payload.mechanism.code, payload.mechanism.label]);
    rows.push(['segment', payload.segment.code, payload.segment.label]);
    rows.push(['anatomic', payload.anatomic.code, payload.anatomic.label]);
    rows.push(['volume_percent', payload.volume_percent + '%', payload.volume_percent + '%']);
    rows.push(['edema_length_mm', payload.edema_length_mm, payload.edema_length_mm + ' mm']);
    rows.push(['rupture_gap_mm', payload.rupture_gap_mm, payload.rupture_gap_mm + ' mm']);
    rows.push(['mlgr', payload.mlgr.code, payload.mlgr.label]);
    rows.push(['tendon_involvement', payload.tendon_involvement.code, payload.tendon_involvement.label]);
    rows.push(['complete_tear', payload.complete_tear.code, payload.complete_tear.label]);
    rows.push(['reinjury_last6mo', payload.reinjury_last6mo.code, payload.reinjury_last6mo.label]);
    rows.push(['timestamp', '-', payload.timestamp]);

    varsTableBody.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(String(r[0]))}</td><td>${escapeHtml(String(r[1]))}</td><td>${escapeHtml(String(r[2]))}</td>`;
      varsTableBody.appendChild(tr);
    });
  }

  // Auto-update BAMIC preview and table
  function autoUpdateBAMIC() {
    const p = buildPayload();
    const b = deriveBAMIC(p);
    // set BAMIC and a note clarifying it's simulation of backend
    bamicDisplay.textContent = `Lesão de Classificação ${b.grade}${b.suffix ? b.suffix : ''} — ${b.text}`;
    bamicSimNote.innerHTML = 'Esta classificação é gerada pela simulação do Back-End. Referência: <em>The British Athletics Muscle Injury Classification (BAMIC/BAC)</em>.';
    updateVarsTable(p);
    updateJSONOut(p);
  }

  // wire inputs
  const watchIds = ['muscle','mechanism','segment','anatomic','volumePercent','edemaLength','ruptureGap','mlgr','tendonInvolvement','completeTear','reinjury'];
  watchIds.forEach(id => {
    const el = qs(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (id === 'volumePercent') {
        volumePercentLabel.textContent = el.value || '0';
      }
      autoUpdateBAMIC();
    });
    el.addEventListener('change', autoUpdateBAMIC);
  });

  // initial
  volumePercentLabel.textContent = volumePercent.value;
  autoUpdateBAMIC();

  // button handlers
  btnCalc.addEventListener('click', async () => {
    const payload = buildPayload();
    updateJSONOut(payload);
    updateVarsTable(payload);
    setProcessing(true);
    scoreDisplay.textContent = 'Score: — / 100';
    rtpDisplay.textContent = '—';
    updateAPIOut({status:'pending'});

    try {
      const resp = await simulateBackend(payload);
      scoreDisplay.textContent = `Score: ${resp.score} / 100`;
      bamicDisplay.textContent = `Lesão de Classificação ${resp.bamic_grade} — ${resp.bamic_text}`;
      bamicSimNote.innerHTML = 'Esta classificação é gerada pela simulação do Back-End. Referência: <em>The British Athletics Muscle Injury Classification (BAMIC/BAC)</em>.';
      rtpDisplay.textContent = resp.rtp_estimate_days.text;
      updateAPIOut(resp);
    } catch (err) {
      updateAPIOut({ ok:false, error:String(err) });
    } finally {
      setProcessing(false);
    }
  });

  btnSend.addEventListener('click', async () => {
    const payload = buildPayload();
    updateJSONOut(payload);
    updateVarsTable(payload);

    const ep = apiEndpoint.value.trim() || '(endpoint não configurado - simulação)';
    setProcessing(true);
    updateAPIOut({status:'posting', endpoint: ep});
    await new Promise(res => setTimeout(res, 600 + Math.random()*800));
    const serverResp = await simulateBackend(payload);
    serverResp.endpoint = ep;
    serverResp.simulated_send = true;
    updateAPIOut(serverResp);
    setProcessing(false);

    scoreDisplay.textContent = `Score: ${serverResp.score} / 100`;
    bamicDisplay.textContent = `Lesão de Classificação ${serverResp.bamic_grade} — ${serverResp.bamic_text}`;
    bamicSimNote.innerHTML = 'Esta classificação é gerada pela simulação do Back-End. Referência: <em>The British Athletics Muscle Injury Classification (BAMIC/BAC)</em>.';
    rtpDisplay.textContent = serverResp.rtp_estimate_days.text;
  });

  // expose for debug
  window._injuryProto = { buildPayload, scoreFromPayload, deriveBAMIC, simulateBackend };
})();
