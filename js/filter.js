function containQuery(attributes, queryWords) {
  for (let q = 0; q < queryWords.length; ++q) {
    let queryWord = queryWords[q].replace(/\+/g, " ");
    let found = false;

    const attributeSpecificatorPos = queryWord.indexOf(":");
    if (attributeSpecificatorPos >= 0) {
      const attribute = queryWord.substr(0, attributeSpecificatorPos);
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

function filterByQuery(query, groups, elementSelector, updateHash = true) {
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
      const elements = group.querySelectorAll(elementSelector);
      for (let e = 0; e < elements.length; ++e) {
        const element = elements[e];
        const attributes = element.dataset;
        if (containQuery(attributes, queryWords)) {
          element.classList.remove("uk-hidden");
          filteredAllOfGroup = false;
        } else {
          element.classList.add("uk-hidden");
        }
      }

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

  if (updateHash) { // webis.de page
    if (query.trim() !== "") {
      document.location.hash = "#?q=" + query;
    } else if (document.location.hash.startsWith("#?q=")) {
      document.location.hash = "";
    }
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
    if (a == "author" || a == "tags" || a == "editor" || a == "artifacts") {
      attributes[a] = normalize(attributes[a], protectCommata = true, protectQueryModifiers = false);
    } else {
      attributes[a] = normalize(attributes[a]);
    }
  }
  attributes['text'] = normalize(node.textContent);
  return attributes;
}

/*
 * filterFunction: a function that takes a filter query and filters the list on the page accordingly
 * filterField: the input field to initialize
 */
function initializeFilterField(filterFunction, filterField = document.getElementById("filter-field")) {
  if (filterField !== null) {
    // remove spurious "\"
    if (document.location.hash.indexOf("\\") > 0) {
        document.location.hash = document.location.hash.replace(/\\/g, "");
    }

    // Set up filter field
    if (document.location.hash.startsWith("#?q=")) {
        const query = decodeURIComponent(document.location.hash.substr(4));
        filterField.value = query;
    }
    filterField.addEventListener("input", event => filterFunction(event.target.value));
    filterFunction(filterField.value);
    if (document.location.hash.startsWith("#?q=") || document.location.hash === "") {
        filterField.focus();
    }

    // Update if hash in URL changed (e.g., browser back button)
    window.addEventListener("hashchange", event => {
      if (document.location.hash.startsWith("#?q=")) {
        const query = decodeURIComponent(document.location.hash.substr(4));
        if (query !== filterField.value) {
          filterField.value = query;
          filterFunction(query);
        }
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
function makeFilterFunction(groups, elementSelector, updateHash = true) {
  const filterFunction = (query) => {
    return filterByQuery(query, groups, elementSelector, updateHash);
  };
  return filterFunction;
}

/*
 * groups: the groups in which the elements should be filtered
 * elementSelector: query selector that specifies each element within a group to be filtered
 * updateHash: Whether to update the window.location.hash on filtering
 * dataAttributesPopulationFunction: a function that takes the DOM node of an element and sets the data-attributes of the respective node
 */
function initWebisFiltering(groups, elementSelector, updateHash = true, dataAttributesPopulationFunction = defaultDataAttributesPopulationFunction) {
  populateDataAttributesForGroups(groups, elementSelector, dataAttributesPopulationFunction);
  const filterFunction = makeFilterFunction(groups, elementSelector, updateHash);
  initializeFilterField(filterFunction)
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

// update legacy 'filter:' option
if (document.location.hash.startsWith("#filter:")) {
    const query = decodeURIComponent(document.location.hash.substr(8));
    document.location.hash = "#?q=" + query;
}

////////////////////////////////////////////////////
// Specific code for common web page layouts
////////////////////////////////////////////////////

function initWebisListFiltering(lists = document.querySelectorAll(".webis-list"), updateHash = true) {
  const elementSelector = ".entry";
  return initWebisFiltering(lists, elementSelector, updateHash, defaultDataAttributesPopulationFunction);
}

function initWebisParagraphsFiltering(paragraphs = document.querySelectorAll(".webis-paragraphs"), updateHash = true) {
  const elementSelector = "p";
  return initWebisFiltering(paragraphs, elementSelector, updateHash, defaultDataAttributesPopulationFunction);
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

function initWebisDataFiltering(tables = document.querySelectorAll(".targetable"), updateHash = true) {
  const elementSelector = "tbody tr";
  initTableSorting(tables);
  return initWebisFiltering(tables, elementSelector, updateHash, dataTableDataAttributesPopulationFunction);
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

function initWebisPublicationsFiltering(groups = document.querySelectorAll(".year-entry"), updateHash = true) {
  groups.forEach(group => activateBibtexToggle(group))
  const elementSelector = ".bib-entry";
  return initWebisFiltering(groups, elementSelector, updateHash, defaultDataAttributesPopulationFunction);
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
    const filterFunction = initWebisPublicationsFiltering(bibList.querySelectorAll(".year-entry"), updateHash = false);
    filterFunction(query);
    bibList.classList.remove("uk-container", "uk-margin-medium");
    if (yearHeadingSize === null) {
      removeBibHeading(bibList);
    } else if (yearHeadingSize !== 2) {
      changeBibHeadingSize(bibList, yearHeadingSize);
    }
  });
}

/*
 * Removes all list headings
 */
function removeBibHeading(bibList) {
  bibList.querySelectorAll("h2").forEach(heading => {
    heading.remove();
  });
}

/*
 * Changes the headings from h2 to h<headingSize>
 */
function changeBibHeadingSize(bibList, headingSize) {
  bibList.querySelectorAll("h2").forEach(heading => {
    heading.outerHTML = heading.outerHTML.replace(/^<h2/, "<h" + headingSize).replace(/h2>/, "h" + headingSize + ">");
  });
}



