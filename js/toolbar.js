/* ---------- Shared view-panel toolbar generator ----------
   Loaded as a classic (non-module) script from <head>, so `renderToolbar` is
   a plain global function available by the time each panel's inline
   <script>document.write(renderToolbar(...))</script> call runs during HTML
   parsing — i.e. always before js/main.js (a deferred module script) loads
   the view modules that grab these toolbar elements by ID.

   Not every view-panel toolbar matches this pattern closely enough to be
   worth generating this way: Activity uses a from/to date range (not a
   search box or category filter), and Requests has no toolbar at all — both
   are left as static markup in index.html.
*/
function renderToolbar(config){
  const search = config.search || null;
  const filters = config.filters || [];
  const extraButtons = config.extraButtons || [];
  const viewMode = config.viewMode || null;
  const addButton = config.addButton || null;
  const countRowId = config.countRowId || null;
  const gridId = config.gridId || null;
  const extraHtml = config.extraHtml || '';

  const searchHtml = search ? (
    '<div class="search-box">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input id="' + search.id + '" type="text" placeholder="' + search.placeholder + '" autocomplete="off" name="' + search.name + '">' +
    '</div>'
  ) : '';

  const filtersHtml = filters.map(function(f){
    const optionsHtml = (f.options || []).map(function(o){
      return '<option value="' + o.value + '">' + o.label + '</option>';
    }).join('');
    return '<select id="' + f.id + '"><option value="">' + f.defaultLabel + '</option>' + optionsHtml + '</select>';
  }).join('');

  const extraButtonsHtml = extraButtons.map(function(b){
    return '<button class="btn ' + (b.className || 'btn-ghost') + '" id="' + b.id + '">' + b.label + '</button>';
  }).join('');

  const viewModeHtml = viewMode ? (
    '<div class="view-mode-toggle"' + (viewMode.style ? ' style="' + viewMode.style + '"' : '') + '>' +
      '<button class="view-mode-btn active" data-section="' + viewMode.section + '" data-mode="cards">' + (viewMode.cardsLabel || '▦') + '</button>' +
      '<button class="view-mode-btn" data-section="' + viewMode.section + '" data-mode="table">' + (viewMode.tableLabel || '☰') + '</button>' +
    '</div>'
  ) : '';

  const addButtonHtml = addButton ? ('<button class="btn btn-primary" id="' + addButton.id + '">' + addButton.label + '</button>') : '';

  const hasToolbarContent = !!(search || filters.length || extraButtons.length || addButton);

  // Sections with only a view-mode toggle (e.g. Messages) render it standalone,
  // matching the original markup, instead of wrapping it in a `.toolbar` div.
  const toolbarHtml = hasToolbarContent
    ? '<div class="toolbar">' + searchHtml + filtersHtml + extraButtonsHtml + viewModeHtml + addButtonHtml + '</div>'
    : viewModeHtml;

  const countRowHtml = countRowId ? '<div class="count-row" id="' + countRowId + '"></div>' : '';
  const gridHtml = gridId ? '<div id="' + gridId + '"></div>' : '';

  return toolbarHtml + extraHtml + countRowHtml + gridHtml;
}
