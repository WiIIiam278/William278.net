window.onload = () => {
    let pluginList = ''
    PROJECTS.forEach((plugin) => {
        if (plugin.documentation) {
            pluginList += '<li><a href="docs/' + plugin.name.toLowerCase() + '/Home">' + plugin.name + '</a></li>'
        }
    });

    let elements = document.getElementsByClassName('docs-page-product-list');
    for (let i = 0; i < elements.length; i++) {
        elements[i].innerHTML = pluginList;
    }
}
