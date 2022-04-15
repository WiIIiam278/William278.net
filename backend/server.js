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
const gitPullOrClone = require('git-clone-or-pull');
const path = require('path');
const {PROJECTS} = require("../frontend/projects");

const DOCS_PAGE_TEMPLATE = fs.readFileSync('frontend/docs/docs.html').toString();
const CHECK_DOCUMENT_ENDS = ['', '.html', '.md']

function fetchPlugin(repository, name) {
    let wikiRepository = repository + '.wiki.git';
    const filePath = 'frontend/docs/' + name.toLowerCase();
    gitPullOrClone(wikiRepository, filePath, function (err) {
        if (err) {
            console.error('Error pulling ' + wikiRepository + ' to ' + filePath)
            console.error(err);
            return;
        }
        console.log('Updated ' + name);
    });
}

// Fetch repositories
for (let i = 0; i < PROJECTS.length; i++) {
    let project = PROJECTS[i];
    if (project.documentation === true) {
        fetchPlugin(project.repository, project.name);
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
        if (request.method === 'GET') {
            sendRequestedPage('frontend/' + request.url.substring(request.url.indexOf('/') + 1), response);
        } else if (request.method === 'POST') {
            handleWebhook(request.url.substring(request.url.indexOf('/') + 1), request, response);
        } else {
            response.writeHead(405);
            response.end('Unsupported method.')
        }
    } catch (error) {
        response.writeHead(500);
        fs.createReadStream('frontend/500.html').pipe(response);
        console.log(error);
    }
}

function handleWebhook(requestPath, request, response) {
    try {
        if (requestPath.startsWith('api/update-docs')) {
            let data = '';
            request.on('data', chunk => {
                data += chunk;
            })
            request.on('end', () => {
                try {
                    const DATA = JSON.parse(data);

                    let repository = DATA.repository.svn_url;
                    let name = '';

                    // Validate repository
                    let isValid = false;
                    for (let i = 0; i < PROJECTS.length; i++) {
                        let project = PROJECTS[i];
                        if (project.repository === repository && project.documentation === true) {
                            name = project.name;
                            isValid = true;
                            break;
                        }
                    }
                    if (isValid === false) {
                        response.writeHead('400');
                        response.end('Invalid repository');
                        return;
                    }

                    // Update repository
                    fetchPlugin(repository, name);

                    response.writeHead('200');
                    response.end('Updated documentation');
                } catch (error) {
                    response.writeHead('500');
                    response.end('Error parsing data body');
                }
            })
        } else {
            response.writeHead('404');
            response.end('Not found')
        }
    } catch (error) {
        response.writeHead('500');
        response.end('Unknown server error');
        console.error(error);
    }
}

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

// Start server
const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on ${host}:${port}`);
    console.log('[Pterodactyl] Ready');
});