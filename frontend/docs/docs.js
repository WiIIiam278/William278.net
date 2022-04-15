window.onload = () => {
    let pluginList = ''
    PROJECTS.forEach((project) => {
        if (project.documentation) {
            pluginList += '<li><object data="images/icons/' + project.icon + '" type="image/svg+xml" width="17.5"></object>&nbsp;<a href="docs/' + project.name.toLowerCase() + '/Home">' + project.name + '</a></li>'
        }
    });

    let elements = document.getElementsByClassName('docs-page-product-list');
    for (let i = 0; i < elements.length; i++) {
        elements[i].innerHTML = pluginList;
    }
}
