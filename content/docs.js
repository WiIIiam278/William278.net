let fetchedProjects;
let isRootPage = false;
let thisProject;

window.onload = () => {
    // If the page url ends with /Home/ hide all elements with class docs-index.pug-hidden
    if (window.location.pathname.endsWith('/Home')) {
        document.querySelectorAll('.docs-index.pug-hidden').forEach(element => {
            element.style.display = 'none';
        });
    } else if (window.location.pathname.endsWith('/docs')) {
        isRootPage = true;
    }

    if (!isRootPage) {
        thisProject = window.location.pathname.split('/')[2].toLowerCase();
    }

    // Display projects on sidebar
    fetch('/api/projects').then(projects => {
        return projects.text();
    }).then(projects => {
        return JSON.parse(projects);
    }).then(projects => {
        let pluginElements = ''
        fetchedProjects = projects;
        fetchedProjects.forEach((project) => {
            if (project.documentation) {
                pluginElements += '<li><object class="docs-project-icon" data="/images/icons/' + project.icons.svg + '" type="image/svg+xml"></object>&nbsp;<a href="/docs/' + project.name.toLowerCase() + '">' + project.name + '</a></li>'
            }
        });
        return pluginElements;
    }).then(pluginElements => {
        let productList = document.getElementsByClassName('docs-page-product-list');
        for (let i = 0; i < productList.length; i++) {
            productList[i].innerHTML = pluginElements;
        }
    }).then(() => {
        let links = document.getElementsByTagName('a');
        for (let i = 0; i < links.length; i++) {
            if (links[i].hostname !== window.location.hostname && (links[i].innerText.length > 0) && links[i].className !== 'footer-link' && links[i].className !== 'button-link' && links[i].id !== 'site-version-indicator-link') {
                links[i].innerHTML += '&nbsp;<i class="fa-solid fa-arrow-up-right-from-square"></i>'
            }
        }
    }).then(() => {
        // When the docs-search input is changed
        document.getElementById('docs-search').oninput = () => {
            // Hide docs-page-sidebar-content when the box has elements in it
            let searchQuery = document.getElementById('docs-search').value;
            let queryLength = searchQuery.length;
            if (queryLength > 0) {
                document.getElementById('sidebar-content').style.display = 'none';
                document.getElementById('docs-search-results').style.display = 'block';
                if (queryLength > 32) {
                    document.getElementById('docs-search').value = searchQuery.substring(0, 32);
                }
            } else {
                document.getElementById('sidebar-content').style.display = 'block';
                document.getElementById('docs-search-results').style.display = 'none';
                return;
            }

            // Dont request queries that only contain punctuation or spaces
            if (searchQuery.match(/^[\s.,;:!?()]+$/)) {
                document.getElementById('docs-search-results').innerHTML = '';
                return;
            }

            // Search for the input value
            let query;
            if (isRootPage) {
                query = `/api/search-docs?query=${document.getElementById('docs-search').value}`;
            } else {
                query = `/api/search-docs/${thisProject}?query=${document.getElementById('docs-search').value}`;
            }
            fetch(query).then(results => {
                if (results.status !== 200) {
                    throw new Error('Error searching docs');
                }
                return results.text();
            }).then(results => {
                return JSON.parse(results);
            }).then(results => {
                // Sort results firstly by number of title-matches, then number of content-matches
                return results.sort((a, b) => {
                    if (a.name_matches > b.name_matches) {
                        return -1;
                    } else if (a.name_matches < b.name_matches) {
                        return 1;
                    } else {
                        if (a.content_matches > b.content_matches) {
                            return -1;
                        } else if (a.content_matches < b.content_matches) {
                            return 1;
                        } else {
                            return 0;
                        }
                    }
                });
            }).then(results => {
                // If the list is longer than 15, only show the first 15
                if (results.length > 15) {
                    results = results.slice(0, 15);
                }
                return results;
            }).then(results => {
                document.getElementById('docs-search-results').innerHTML = '';

                // If the list is empty, display a message
                if (results.length === 0) {
                    document.getElementById('docs-search-results').innerHTML = '<p>No results found</p>';
                    return;
                }

                // Display results
                results.forEach((result) => {
                    // Find matching project from fetched projects
                    let project = fetchedProjects.find(project => project.name.toLowerCase() === result.project.toLowerCase());
                    let resultElement = document.createElement('p');
                    resultElement.className = 'docs-search-result';

                    let resultIcon = document.createElement('object');
                    resultIcon.className = 'docs-project-icon';
                    resultIcon.data = `/images/icons/${project.icons.svg}`;
                    resultIcon.type = 'image/svg+xml';
                    resultElement.appendChild(resultIcon);

                    let resultLink = document.createElement('a');
                    resultLink.href = result.url;
                    resultLink.innerText = result.name;
                    resultElement.appendChild(resultLink);

                    document.getElementById('docs-search-results').appendChild(resultElement);
                });
            }).catch(error => {
                console.log(error);
            });
        }

    });
}
