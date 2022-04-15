const http = require("http");
const fs = require('fs');
const sanitizeFileName = require('sanitize-filename')
const wikiLinks = require('markdown-it-wikilinks')({
    postProcessPageName: (pageName) => {
        pageName = pageName.trim()
        pageName = pageName.split('/').map(sanitizeFileName).join('/')
        pageName = pageName.replace(/\s+/, '-')
        return pageName
    },
    uriSuffix: ''
})
const prism = require('markdown-it-prism');
const MarkdownIt = require('markdown-it'), md = new MarkdownIt({
    html: true,
    xhtmlOut: true,
    breaks: true
}).use(wikiLinks).use(prism, {defaultLanguage: 'yml'});
const gitPullOrClone = require('git-pull-or-clone')
const {PROJECTS} = require("../frontend/projects");

const DOCS_PAGE_TEMPLATE = fs.readFileSync('frontend/docs/docs.html').toString();
const CHECK_DOCUMENT_ENDS = ['', '.html', '.md']

function fetchPlugin(plugin) {
    let wikiRepository = plugin.repository + '.wiki.git';
    const path = 'frontend/docs/' + plugin.name.toLowerCase();
    gitPullOrClone(wikiRepository, path, (err) => {
        if (err) throw err
        console.log('Updated ' + plugin.name);
    })
}

// Fetch repositories
for (let i = 0; i < PROJECTS.length; i++) {
    let project = PROJECTS[i];
    if (project.documentation === true) {
        fetchPlugin(project);
    }
}


const host = 'localhost';
const port = 8000;

const requestListener = function (request, response) {
    try {
        if (request.url.endsWith('/') && request.url.length > 1) {
            response.writeHead(302, {
                'Location': '../' + request.url.slice(0, -1).substring(request.url.indexOf('/') + 1)
            })
            response.end();
            return;
        }
        sendRequestedPage('frontend/' + request.url.substring(request.url.indexOf('/') + 1), response);
    } catch (error) {
        response.writeHead(500);
        fs.createReadStream('frontend/500.html').pipe(response);
        console.log(error);
    }
};

function sendRequestedPage(targetResourcePath, response) {
    for (let i = 0; i < CHECK_DOCUMENT_ENDS.length; i++) {
        let pathToCheck = targetResourcePath + CHECK_DOCUMENT_ENDS[i];
        if (fs.existsSync(pathToCheck)) {
            if (fs.statSync(pathToCheck).isDirectory()) {
                sendRequestedPage(pathToCheck + '/index.html', response);
                return;
            }
            sendPage(response, fs, pathToCheck);
            return;
        }
    }

    response.writeHead(404);
    fs.createReadStream('frontend/404.html').pipe(response);
}

function sendPage(response, fs, targetPath) {
    // Render MarkDown to html file
    if (targetPath.endsWith('.md')) {
        let contentMarkDown = md.render(fs.readFileSync(targetPath).toString());
        let sideBarMarkDown = '';
        const SIDEBAR_PATH = targetPath.replace(targetPath.substring(targetPath.lastIndexOf('/') + 1), '_Sidebar.md');
        if (fs.existsSync(SIDEBAR_PATH)) {
            sideBarMarkDown = md.render(fs.readFileSync(SIDEBAR_PATH).toString());
        }
        let pageTitle = targetPath.substring(targetPath.lastIndexOf('/') + 1)
            .replace('-', ' ')
            .replace('.md', '');

        response.writeHead(200);
        response.end(DOCS_PAGE_TEMPLATE.replace('{DOCS_PAGE_SIDEBAR_CONTENT}', sideBarMarkDown)
            .replace('{DOCS_PAGE_CONTENT}', contentMarkDown)
            .replace('{PROJECT_TITLE}', targetPath.split('/')[2])
            .replace('{DOCS_PAGE_TITLE}', pageTitle)
            .replace('{DOCS_PAGE_TITLE}', pageTitle));
        return;
    }

    // Send scalable vector graphic
    if (targetPath.endsWith('.svg')) {
        response.writeHead(200, {
            'Content-Type': 'image/svg+xml'
        });
        fs.createReadStream(targetPath).pipe(response)
        return;
    }

    // Send other file
    response.writeHead(200);
    fs.createReadStream(targetPath).pipe(response)
}

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on ${host}:${port}`);
});