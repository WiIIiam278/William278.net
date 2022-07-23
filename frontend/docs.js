window.onload = () => {
    // If the page url ends with /Home/ hide all elements with class docs-home-hidden
    if (window.location.pathname.endsWith('/Home')) {
        document.querySelectorAll('.docs-home-hidden').forEach(element => {
            element.style.display = 'none';
        });
    }

    // Display projects on sidebar
    fetch('/api/projects').then(projects => {
        return projects.text();
    }).then(projects => {
        return JSON.parse(projects);
    }).then(projects => {
        let pluginElements = ''
        projects.forEach((project) => {
            if (project.documentation) {
                pluginElements += '<li><object data="/images/icons/' + project.icon + '" type="image/svg+xml" width="17.5"></object>&nbsp;<a href="/docs/' + project.name.toLowerCase() + '">' + project.name + '</a></li>'
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
            if (links[i].hostname !== window.location.hostname && (links[i].innerText.length > 0) && links[i].className !== 'footer-link' && links[i].className !== 'button-link') {
                links[i].innerHTML += '&nbsp;<i class="fa-solid fa-arrow-up-right-from-square"></i>'
            }
        }
    });
}
