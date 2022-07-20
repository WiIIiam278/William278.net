window.onload = () => {
    let pluginList = ''
    PROJECTS.forEach((project) => {
        if (project.documentation) {
            pluginList += '<li><object data="images/icons/' + project.icon + '" type="image/svg+xml" width="17.5"></object>&nbsp;<a href="docs/' + project.name.toLowerCase() + '/Home">' + project.name + '</a></li>'
        }
    });

    let productList = document.getElementsByClassName('docs-page-product-list');
    for (let i = 0; i < productList.length; i++) {
        productList[i].innerHTML = pluginList;
    }

    let links = document.getElementsByTagName('a');
    for (let i = 0; i < links.length; i++) {
        if (links[i].hostname !== window.location.hostname && (links[i].innerText.length > 0)) {
            // links[i].innerHTML += '&nbsp;<i class="fa-solid fa-arrow-up-right-from-square"></i>'
        }
    }
}
