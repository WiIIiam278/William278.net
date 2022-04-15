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
const SPIGOT_BUTTON_FORMAT = '<a href="{URL_LINK}" target="_blank" class="main-page-product-button fa-solid fa-faucet"></a>\n';
const POLYMART_BUTTON_FORMAT = '<a href="{URL_LINK}" target="_blank" class="main-page-product-button fa-solid fa-p"></a>\n';
const SONGODA_BUTTON_FORMAT = '<a href="{URL_LINK}" target="_blank" class="main-page-product-button fa-solid fa-shield-halved"></a>\n';
const DOCS_BUTTON_FORMAT = '<a href="{URL_LINK}" class="main-page-product-button main-page-product-docs button-link">Docs</a>\n';


window.onload = () => {
    let projects = ''
    PROJECTS.forEach((project) => {


        projects += PROJECT_BOX_FORMAT
            .replace('{PROJECT_NAME}', project.name)
            .replace('{PROJECT_DESC}', project.tagline)
            .replace('{PROJECT_ICON}', project.icon)
            .replace('{PROJECT_BUTTONS}', getProjectButtons(project))
    });

    document.getElementById('main-page-product-grid').innerHTML = projects;
}

function getProjectButtons(project) {
    let projectButtons = '';
    if (project.repository !== undefined && project.repository !== '') {
        projectButtons += GITHUB_BUTTON_FORMAT.replace('{URL_LINK}', project.repository)
    }
    if (project.download.spigot !== undefined && project.download.spigot !== '') {
        projectButtons += SPIGOT_BUTTON_FORMAT.replace('{URL_LINK}', project.download.spigot)
    }
    if (project.download.polymart !== undefined && project.download.polymart !== '') {
        projectButtons += POLYMART_BUTTON_FORMAT.replace('{URL_LINK}', project.download.polymart)
    }
    if (project.download.songoda !== undefined && project.download.songoda !== '') {
        projectButtons += SONGODA_BUTTON_FORMAT.replace('{URL_LINK}', project.download.songoda)
    }
    if (project.documentation !== undefined && project.documentation === true) {
        projectButtons += DOCS_BUTTON_FORMAT.replace('{URL_LINK}', '/docs/' + project.name.toLowerCase() + '/Home')
    }
    return projectButtons;
}