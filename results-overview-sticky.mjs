// Entête fixe du récapitulatif professeur pendant le défilement de la PAGE.
// Le défilement horizontal reste réservé aux colonnes d'applications.
let teardown = () => {};
export function attachResultsOverviewSticky(wrapper, table) {
  teardown();
  const head = table.tHead;
  if (!head) return () => {};
  const floating = document.createElement('div');
  floating.className = 'results-overview-floating-head';
  floating.setAttribute('aria-hidden', 'true');
  const track = document.createElement('div');
  track.className = 'results-overview-floating-track';
  const clone = document.createElement('table');
  clone.className = 'results-overview-table results-overview-floating-table';
  const clonedHead = head.cloneNode(true);
  clone.append(clonedHead);
  track.append(clone);
  floating.append(track);
  document.body.append(floating);
  let disposed = false;
  function update() {
    if (disposed) return;
    const area = wrapper.getBoundingClientRect();
    const original = head.getBoundingClientRect();
    const active = wrapper.isConnected
      && !wrapper.closest('[hidden]')
      && original.top < 0
      && area.bottom > original.height
      && area.right > 0 && area.left < window.innerWidth;
    floating.hidden = !active;
    if (!active) return;
    const sourceCells = Array.from(head.rows[0].cells);
    const targetCells = Array.from(clonedHead.rows[0].cells);
    const widths = sourceCells.map(cell => cell.getBoundingClientRect().width);
    targetCells.forEach((cell, i) => {
      cell.style.width = widths[i] + 'px';
      cell.style.minWidth = widths[i] + 'px';
      cell.style.maxWidth = widths[i] + 'px';
    });
    floating.style.left = area.left + 'px';
    floating.style.width = area.width + 'px';
    floating.style.height = original.height + 'px';
    clone.style.width = table.getBoundingClientRect().width + 'px';
    track.style.transform = 'translateX(' + (-wrapper.scrollLeft) + 'px)';
    // L'angle « Élève » demeure fixe pendant le défilement horizontal.
    if (targetCells[0]) targetCells[0].style.transform = 'translateX(' + wrapper.scrollLeft + 'px)';
  }
  const onChange = () => update();
  window.addEventListener('scroll', onChange, {passive:true});
  window.addEventListener('resize', onChange);
  wrapper.addEventListener('scroll', onChange, {passive:true});
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
  observer?.observe(wrapper);
  observer?.observe(table);
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('scroll', onChange);
    window.removeEventListener('resize', onChange);
    wrapper.removeEventListener('scroll', onChange);
    observer?.disconnect();
    floating.remove();
  };
  teardown = cleanup;
  update();
  return cleanup;
}
