const PROJECT_BOX_FORMAT = '<div class="main-page-product">\n' +
    '                    <h3 class="main-page-product-title">{PROJECT_NAME}</h3>\n' +
    '                    <object class="main-page-product-image" data="images/icons/{PROJECT_ICON}" type="image/svg+xml"\n' +
    '                            width="75"></object>\n' +
    '                    <p class="main-page-product-content">\n' +
    '                        {PROJECT_DESC}</p>\n' +
    '                    <div class="main-page-product-buttons">\n' +
    '                        {PROJECT_BUTTONS}' +
    '                    </div>\n' +
    '                </div>'

const GITHUB_BUTTON_FORMAT = '<a href="{URL_LINK}" target="_blank" class="main-page-product-button fa-brands fa-github"></a>\n';
const SPIGOT_BUTTON_FORMAT = '<a href="https://www.spigotmc.org/resources/{ID}" target="_blank" class="main-page-product-button fa-solid fa-faucet"></a>\n';
const POLYMART_BUTTON_FORMAT = '<a href="https://polymart.org/resource/{ID}" target="_blank" class="main-page-product-button fa-solid fa-p"></a>\n';
const SONGODA_BUTTON_FORMAT = '<a href="https://songoda.com/marketplace/product/{ID}" target="_blank" class="main-page-product-button fa-solid fa-shield-halved"></a>\n';
const DOCS_BUTTON_FORMAT = '<a href="{URL_LINK}" class="main-page-product-button main-page-product-docs button-link">Docs</a>\n';


window.onload = () => {
    fetch('/api/projects').then(projects => {
        return projects.text();
    }).then(projects => {
        return JSON.parse(projects);
    }).then(projects => {
        let projectList = '';
        projects.forEach((project) => {
            projectList += PROJECT_BOX_FORMAT
                .replace('{PROJECT_NAME}', project.name)
                .replace('{PROJECT_DESC}', project.tagline)
                .replace('{PROJECT_ICON}', project.icon)
                .replace('{PROJECT_BUTTONS}', getProjectButtons(project))
        });
        return projectList;
    }).then(projectList => {
        document.getElementById('main-page-product-grid').innerHTML = projectList;
    }).catch(err => {
        console.log(err);
    })

}

const getProjectButtons = (project) => {
    let projectButtons = '';
    if (project.repository !== undefined && project.repository !== '') {
        projectButtons += GITHUB_BUTTON_FORMAT.replace('{URL_LINK}', project.repository)
    }
    if (project.ids.spigot !== undefined && project.ids.spigot !== '') {
        projectButtons += SPIGOT_BUTTON_FORMAT.replace('{ID}', project.ids.spigot)
    }
    if (project.ids.polymart !== undefined && project.ids.polymart !== '') {
        projectButtons += POLYMART_BUTTON_FORMAT.replace('{ID}', project.ids.polymart)
    }
    if (project.ids.songoda !== undefined && project.ids.songoda !== '') {
        projectButtons += SONGODA_BUTTON_FORMAT.replace('{ID}', project.ids.songoda)
    }
    if (project.documentation !== undefined && project.documentation === true) {
        projectButtons += DOCS_BUTTON_FORMAT.replace('{URL_LINK}', '/docs/' + project.name.toLowerCase() + '/Home')
    }
    return projectButtons;
}