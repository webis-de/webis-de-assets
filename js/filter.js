////////////////////////////////////////////////////
// Generic code for filter-based history manipulation
////////////////////////////////////////////////////

const historyNewStateThresholdMs = 1000;
let lastHistoryChangeMs = new Date().getTime();

// Patch updateUrlQueryParameter to encode '+' as space in the URL
function updateUrlQueryParameter(query) {
  const url = new URL(document.location.href);

  // Build the URL value: every literal "+" is written as a space
  const queryForUrl = encodeQueryForUrl(query);

  if (queryForUrl.trim() === "") {
    if (!url.searchParams.has("q")) {
      return;
    } else {
      url.searchParams.delete("q");
    }
  } else {
    if (url.searchParams.has("q") && url.searchParams.get("q") === queryForUrl) {
      return;
    } else {
      url.searchParams.set("q", queryForUrl);
    }
  }

  const now = new Date().getTime();
  const msSinceLastHistoryChange = now - lastHistoryChangeMs;
  lastHistoryChangeMs = now;

  if (msSinceLastHistoryChange >= historyNewStateThresholdMs) {
    history.pushState({ query: queryForUrl }, "", url);
  } else {
    history.replaceState({ query: queryForUrl }, "", url);
  }
}


////////////////////////////////////////////////////
// Generic code for filtering
////////////////////////////////////////////////////

function containQuery(attributes, queryWords) {
  for (let q = 0; q < queryWords.length; ++q) {
    let queryWord = queryWords[q].replace(/\+/g, " ");
    let found = false;

    const attributeSpecificatorPos = queryWord.indexOf(":");
    if (attributeSpecificatorPos >= 0) {
      let attribute = queryWord.substr(0, attributeSpecificatorPos);
      if (attribute == "tags") { attribute = "keywords"; } // legacy attribute name
      queryWord = queryWord.substr(attributeSpecificatorPos + 1);
      if (attributes.hasOwnProperty(attribute)) {
        const attributeValue = attributes[attribute];
        if (attributeValue.indexOf(queryWord) >= 0) {
          found = true;
        }
      }
    } else {
      for (let a in attributes) {
        const attributeValue = attributes[a];
        if (attributeValue.indexOf(queryWord) >= 0) {
          found = true;
          break;
        }
      }
    }
    if (!found) {
      return false;
    }
  }
  return true;
};

function getSubGroupHeader(group, element) {
  const subGroupId = element.dataset['subGroup'];
  if (subGroupId === undefined) {
    return null;
  } else {
    const subGroupHeader = group.querySelector('[data-sub-group-header="' + subGroupId + '"]');
    return subGroupHeader;
  }
}

function filterByQuery(query, groups, elementSelector, updateUrlQueryParam = true) {
  query = query.trim();
  let filteredAll = true;
  if (query === "") {
    for (let g = 0; g < groups.length; ++g) {
      groups[g].classList.remove("uk-hidden");
      const elements = groups[g].querySelectorAll(elementSelector);
      for (let e = 0; e < elements.length; ++e) {
        elements[e].classList.remove("uk-hidden");
      }
    }
    filteredAll = false;
  } else {
    const queryWords = normalize(query, protectCommata = false, protectQueryModifiers = true).split(/\s+/);
    for (let g = 0; g < groups.length; ++g) {
      const group = groups[g];
      let filteredAllOfGroup = true;
      let visibleSubGroupHeaders = [];
      const elements = group.querySelectorAll(elementSelector);
      for (let e = 0; e < elements.length; ++e) {
        const element = elements[e];
        const subGroupHeader = getSubGroupHeader(group, element);
        if (subGroupHeader !== null && !subGroupHeader.classList.contains("uk-hidden")) {
          element.classList.remove("uk-hidden");
          filteredAllOfGroup = false;
        } else {
          const attributes = element.dataset;
          if (containQuery(attributes, queryWords)) {
            element.classList.remove("uk-hidden");
            filteredAllOfGroup = false;
            if (subGroupHeader !== null) { visibleSubGroupHeaders.push(subGroupHeader) };
          } else {
            element.classList.add("uk-hidden");
          }
        }
      }

      visibleSubGroupHeaders.forEach(
          subGroupHeader => subGroupHeader.classList.remove("uk-hidden"));

      if (filteredAllOfGroup) {
        group.classList.add("uk-hidden");
      } else {
        group.classList.remove("uk-hidden");
        filteredAll = false;
      }
    }
  }

  const filteredAllMessage = document.getElementById("filtered-all-message");
  if (filteredAllMessage !== null) {
    if (filteredAll) {
      filteredAllMessage.classList.remove("uk-hidden");
      filteredAllMessage.removeAttribute("aria-hidden");
    } else {
      filteredAllMessage.classList.add("uk-hidden");
      filteredAllMessage.setAttribute("aria-hidden", "true");
    }
  }

  if (updateUrlQueryParam) { // webis.de page
    updateUrlQueryParameter(query);
  }

  if (typeof UIkit !== "undefined") {
    // Force UIkit update to prevent glitches
    UIkit.update();
  }

  return filteredAll;
};

function normalize(value, protectCommata = false, protectQueryModifiers = false) {
  const regexBase = /[^\u{61}-\u{7a}\u{df}-\u{f6}\u{f8}-\u{ff}\u{100}-\u{17F}0-9\-,:+\s]/gu;
  const regexCommata = /[,]/g;
  const regexQueryModifiers = /[:+]/g;
  const regexWhitespace = /[\s]/g;
  
  let tmp = value.toLowerCase().normalize("NFD").replace(/[\u{300}-\u{36f}]/gu, "").replace(regexBase, "");
  if (!protectCommata) tmp = tmp.replace(regexCommata, "");
  if (!protectQueryModifiers) tmp = tmp.replace(regexQueryModifiers, "");
  tmp = tmp.replace(regexWhitespace, " ");

  return tmp;
};

function removeHyphenationPossibilities(value) {
  return value.replace(/&shy;/g, "");
};

/*
 * groups: node list of group nodes for which the attributes should be populated
 * elementSelector: query selector that specifies each element within a group to be populated
 * dataAttributesPopulationFunction: a function that takes the DOM node of an element and sets the data-attributes of the respective node
 */
function populateDataAttributesForGroups(groups, elementSelector, dataAttributesPopulationFunction) {
  for (let g = 0; g < groups.length; ++g) {
    const elements = groups[g].querySelectorAll(elementSelector);
    populateDataAttributesForElements(elements, dataAttributesPopulationFunction)
  }
}

/*
 * elements: node list of elements for which the attributes should be populated
 * dataAttributesPopulationFunction: a function that takes the DOM node of an element and sets the data-attributes of the respective node
 */
function populateDataAttributesForElements(elements, dataAttributesPopulationFunction) {
  for (let e = 0; e < elements.length; ++e) {
    dataAttributesPopulationFunction(elements[e]);
    // remove &shy; from all attributes (Chrome seems to insert them automatically)
    const dataset = elements[e].dataset;
    for (let a in dataset) {
      dataset[a] = removeHyphenationPossibilities(dataset[a]);
    }
  }
}

/*
 * node: the element for which to set the data-attributes
 */
function defaultDataAttributesPopulationFunction(node) {
  const attributes = node.dataset;
  for (let a in attributes) {
    if (a == "author" || a == "tags" || a == "editor" || a == "artifacts" || a == "mentor") {
      attributes[a] = normalize(attributes[a], protectCommata = true, protectQueryModifiers = false);
    } else {
      attributes[a] = normalize(attributes[a]);
    }
  }
  attributes['text'] = normalize(node.textContent);
  attributes['fields'] = Object.keys(attributes).join(" ");
  attributes['links'] = Array.from(node.querySelectorAll("a")).map(link => link.getAttribute("href")).join(" ");
  return attributes;
}

/*
 * filterFunction: a function that takes a filter query and filters the list on the page accordingly
 * filterField: the input field to initialize
 */

// Treat "+" as space for filtering, but keep "+" visible in the input
function normalizePlusForFiltering(str) {
  return String(str).replace(/\+/g, " ");
}

// When writing to the URL, encode "+" as space so the querystring carries spaces
function encodeQueryForUrl(q) {
  return String(q).replace(/\+/g, " ");
}

function initializeFilterField(filterFunction, filterField = document.getElementById("filter-field")) {
  if (filterField !== null) {
    // remove spurious "\"
    if (document.location.search.indexOf("\\") > 0) {
      document.location.search = document.location.search.replace(/\\/g, "");
    }

    // Read initial value from URL (this will already have '+' decoded as spaces by URLSearchParams)
    let params = new URLSearchParams(document.location.search);
    if (params.has("q") && params.get("q") !== "") {
      const qFromUrl = params.get("q");        // may contain spaces, not literal plus
      filterField.value = qFromUrl;            // show exactly what the URL had (spaces stay spaces)
    }

    // While typing: keep "+" visible, but filter with "+" treated as space
    filterField.addEventListener("input", (event) => {
      const raw = event.target.value;                // keep as-is (includes any '+')
      const normalizedForFilter = normalizePlusForFiltering(raw);
      filterFunction(normalizedForFilter);
    });

    // First filter run
    filterFunction(normalizePlusForFiltering(filterField.value));

    if (document.location.hash === "") {
      filterField.focus();
    }

    // Back/forward navigation: set field from URL and filter accordingly
    window.addEventListener("popstate", () => {
      let params = new URL(document.location).searchParams;
      if (params.has("q")) {
        const q = params.get("q"); // spaces from URLSearchParams
        filterField.value = q;
        filterFunction(normalizePlusForFiltering(q));
      } else {
        filterField.value = "";
        filterFunction("");
      }
    });
  }
}
/*
 * groups: the groups in which the elements should be filtered
 * elementSelector: query selector that specifies each element within a group to be filtered
 * updateHash: Whether to update the window.location.hash on filtering
 */
function makeFilterFunction(groups, elementSelector, updateUrlQueryParam = true) {
  const filterFunction = (query) => {
    return filterByQuery(query, groups, elementSelector, updateUrlQueryParam);
  };
  return filterFunction;
}

/*
 * groups: the groups in which the elements should be filtered
 * elementSelector: query selector that specifies each element within a group to be filtered
 * updateHash: Whether to update the window.location.hash on filtering
 * dataAttributesPopulationFunction: a function that takes the DOM node of an element and sets the data-attributes of the respective node
 */
function initWebisFiltering(groups, elementSelector, updateUrlQueryParam = true, dataAttributesPopulationFunction = defaultDataAttributesPopulationFunction) {
  populateDataAttributesForGroups(groups, elementSelector, dataAttributesPopulationFunction);
  const filterFunction = makeFilterFunction(groups, elementSelector, updateUrlQueryParam);
  initializeFilterField(filterFunction);
  return filterFunction;
}

/*
 * Chrome does not apply the :target selector if the node with the ID was added after the hash changed. This function changes the has back and forth (if one was set) so that Chrome applies the :target selector correctly.
 */
function updateCssTargetSelector() {
  // fix for chrome to jump to anchor that was just inserted:
  const hash = window.location.hash;
  if (hash !== "") {
    window.location.hash = "";
    window.location.hash = hash;
  }
};

/*
 * parentElement: DOM element to which the list should be added
 * sourceUrl: URL of the page that contains the list to be added
 * listSelector: query selector to select the list in the source document
 * listCallback: function that is called on the list before it is added to the parent element
 */
function includeList(parentElement, sourceUrl, listSelector, listCallback) {
  parentElement.innerText = "Loading...";

  const request = new XMLHttpRequest();
  request.onload = function() {
    const list = this.response.documentElement.querySelector(listSelector);
    listCallback(list);
    parentElement.innerText = "";
    parentElement.appendChild(list);
    updateCssTargetSelector();
  }
  request.open("GET", sourceUrl);
  request.responseType = "document";
  request.send();
};

// --- Legacy URL migrations (hash-based) -----------------------------

// Helper: decode old hash payload and normalize "+" to spaces
function decodeLegacyHashQuery(s) {
  // decodeURIComponent does NOT convert "+" to space, so we do it explicitly
  const decoded = decodeURIComponent(s || "");
  return decoded.replace(/\+/g, " ");
}

// update legacy 'filter:' option (e.g., ...#filter:sebastian+heineking)
if (document.location.hash.startsWith("#filter:")) {
  const raw = document.location.hash.substr(8);        // after "#filter:"
  const query = decodeLegacyHashQuery(raw);            // normalize "+" -> " "

  const newUrl = new URL(document.location);
  newUrl.hash = "";
  newUrl.searchParams.set("q", query);                 // writes as space -> "+" in URL
  history.replaceState({ query }, document.title, newUrl.href);
}

// update legacy '#?q=' option (e.g., ...#?q=sebastian+heineking)
if (document.location.hash.startsWith("#?q=")) {
  const raw = document.location.hash.substr(4);        // after "#?q="
  const query = decodeLegacyHashQuery(raw);            // normalize "+" -> " "

  const newUrl = new URL(document.location);
  newUrl.hash = "";
  newUrl.searchParams.set("q", query);                 // writes as space -> "+" in URL
  history.replaceState({ query }, document.title, newUrl.href);
}

////////////////////////////////////////////////////
// Specific code for common web page layouts
////////////////////////////////////////////////////

function initWebisTableFiltering(tables = document.querySelectorAll(".targetable"), updateUrlQueryParam = true, dataAttributesPopulationFunction = defaultDataAttributesPopulationFunction) {
  const elementSelector = "tbody tr";
  extendedDataAttributesPopulationFunction = entry => {
    const attributes = dataAttributesPopulationFunction(entry);

    // add name of table
    attributes['table'] = normalize(entry.closest('table').querySelector('thead').querySelector('tr').textContent.trim());

    // add name of table part
    const groupHeader = entry.querySelector('th[id]');
    if (groupHeader !== null) {
      attributes['subGroupHeader'] = groupHeader.id;
    } else {
      let predecessor = entry.previousElementSibling;
      while (predecessor !== null && predecessor.querySelector('th[id]') == null) {
        predecessor = predecessor.previousElementSibling;
      }
      if (predecessor !== null) {
        attributes['subGroup'] = predecessor.querySelector('th[id]').id;
      }
    }

    return attributes;
  };
  return initWebisFiltering(tables, elementSelector, updateUrlQueryParam, extendedDataAttributesPopulationFunction);
}

function initWebisListFiltering(lists = document.querySelectorAll(".webis-list"), updateUrlQueryParam = true) {
  const elementSelector = ".entry";
  return initWebisFiltering(lists, elementSelector, updateUrlQueryParam, defaultDataAttributesPopulationFunction);
}

function initWebisParagraphsFiltering(paragraphs = document.querySelectorAll(".webis-paragraphs"), updateUrlQueryParam = true) {
  const elementSelector = "p";
  return initWebisFiltering(paragraphs, elementSelector, updateUrlQueryParam, defaultDataAttributesPopulationFunction);
}

////////////////////////////////////////////////////
// Specific code for data
////////////////////////////////////////////////////

/*
 * node: the element for which to set the data-attributes
 */
function dataTableDataAttributesPopulationFunction(node) {
  const attributes = defaultDataAttributesPopulationFunction(node);
  attributes['name'] = normalize(node.children[1].textContent);
  attributes['publisher'] = normalize(node.children[2].textContent);
  attributes['year'] = normalize(node.children[3].textContent);
  attributes['units'] = normalize(node.children[6].textContent);
  attributes['task'] = normalize(node.children[7].textContent);
  const access = Array.from(node.children[8].querySelectorAll("a[title]")).map(aTag => normalize(aTag.getAttribute("title")));
  if (access.length > 0) {
    attributes['access'] = access.join(',');
  }

  return attributes;
}

function initWebisDataFiltering(tables = document.querySelectorAll(".targetable"), updateUrlQueryParam = true) {
  if (typeof initTableSorting === "function") { // tables.js included
    initTableSorting(tables);
  }
  return initWebisTableFiltering(tables, updateUrlQueryParam, dataTableDataAttributesPopulationFunction);
}

////////////////////////////////////////////////////
// Specific code for publications
////////////////////////////////////////////////////

// Show BibTeX on click
function activateBibtexToggle(root = document) {
  root.querySelectorAll('.bib-toggle').forEach(el => el.addEventListener("click", (event) => {
    event.preventDefault();

    const bibtexId = event.target.dataset.target;
    const bibtex = document.getElementById(bibtexId);

    bibtex.classList.toggle("uk-hidden");
    const isHidden = bibtex.classList.contains("uk-hidden");
    if (!isHidden) {
      bibtex.focus();
    }
    bibtex.setAttribute("aria-hidden", isHidden ? "true" : "false");

    bibtex.style.height = "5px";
    bibtex.style.height = (bibtex.scrollHeight + 5) + "px";
  }));
};

// Generate fragment identifier in URL and copy URL to clipboard on click
function activateShareLink(root = document) {
  root.querySelectorAll('.copylink').forEach(el => el.addEventListener("click", (event) => {
    // Prevent page reload for links with empty href (as needed by uni-weimar.de pages)
    event.preventDefault();

    const bibentry = event.target.parentElement;
    const bibid = bibentry.previousElementSibling.id;

    const hash = "#" + bibid;
    history.pushState({ target: bibid }, document.title, hash);

    // Always copy URL when clicking copylink link, even when selecting the same bibentry
    const urlWithoutFilter = window.location.href.replace(window.location.search, "");
    copyStringToClipboard(urlWithoutFilter);

    // Display "copied to clipboard" for 1 s after clicking copylink link
    var copiedSpan = document.createElement("span");
    const copiedText = document.createTextNode("copied to clipboard");
    copiedSpan.appendChild(copiedText);
    event.target.hidden = true;
    event.target.insertAdjacentElement('afterend', copiedSpan);
    setTimeout(function() { event.target.parentNode.removeChild(copiedSpan); event.target.hidden = false }, 1000);

  }));
}

function copyStringToClipboard(str) {
  var el = document.createElement('textarea');
  
  el.value = str;
  el.setAttribute('readonly', '');
  el.style = { position: 'absolute', left: '-9999px' };
  
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

function initWebisPublicationsFiltering(groups = document.querySelectorAll(".year-entry"), updateUrlQueryParam = true) {
  groups.forEach(group => activateBibtexToggle(group))
  groups.forEach(group => activateShareLink(group))
  if (typeof initBibHighlightOnCopyLink === "function") { // selection.js included
    initBibHighlightOnCopyLink();
  }
  const elementSelector = ".bib-entry";
  return initWebisFiltering(groups, elementSelector, updateUrlQueryParam, defaultDataAttributesPopulationFunction);
}

////////////////////////////////////////////////////
// Specific code to include publications
////////////////////////////////////////////////////

/*
 * parentElement: element to which the bibentries should be added
 * query: filter query as used on the webis.de page
 * yearHeadingSize: changes the h2 tags of the year heading to h<yearHeadingSize>
 */
function includeBibentries(parentElement, query = "", yearHeadingSize = 3) {
  const sourceUrl = "https://webis.de/publications.html";
  includeList(parentElement, sourceUrl, '.publications-list', bibList => {
    const filterFunction = initWebisPublicationsFiltering(bibList.querySelectorAll(".year-entry"), false);
    filterFunction(query);
    bibList.classList.remove("uk-container", "uk-margin-medium");
    if (yearHeadingSize === null) {
      removeBibHeading(bibList);
    } else if (yearHeadingSize !== 2) {
      changeBibHeadingSize(bibList, yearHeadingSize);
    }
    if (typeof initBibHighlightOnCopyLink === "function") { // selection.js included
      initBibHighlightOnCopyLink(bibList.querySelectorAll(".copylink"));
    }
  });
}

/*
 * Removes all list headings and combine the groups into one
 */
function removeBibHeading(bibList) {
  const group = document.createElement("div");
  bibList.appendChild(group);

  bibList.querySelectorAll(".year-entry > .bib-entry, .year-entry > a").forEach(node => {
    group.appendChild(node);
  });

  bibList.querySelectorAll(".year-entry").forEach(year => {
    year.remove();
  });

  group.classList.add("year-entry");
}

/*
 * Changes the headings from h2 to h<headingSize>
 */
function changeBibHeadingSize(bibList, headingSize) {
  bibList.querySelectorAll("h2").forEach(heading => {
    heading.outerHTML = heading.outerHTML.replace(/^<h2/, "<h" + headingSize).replace(/h2>/, "h" + headingSize + ">");
  });
}



