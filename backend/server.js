const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const git = require('git-clone-or-pull');
const sitemap = require('express-sitemap');
const rate = require('express-rate-limit')

// Spiget fetching
const {Spiget} = require('spiget');
const spiget = new Spiget("William278UpdateApi");

// GitHub flavoured Markdown parsing
const MarkdownIt = require('markdown-it');
const markdown = new MarkdownIt({
    html: true, xhtmlOut: true, breaks: true
}).use(require('markdown-it-wikilinks')({
    postProcessPageName: (pageName) => {
        pageName = pageName.trim()
        pageName = pageName.split('/').map(require('sanitize-filename')).join('/')
        pageName = pageName.replace(/\s+/, '-')
        return pageName
    }, uriSuffix: ''
})).use(require('markdown-it-anchor'))
    .use(require('markdown-it-prism'), {
        defaultLanguage: 'yml'
    });

// App setup
const app = express();
const host = process.env.HOST || 'localhost';
const port = process.env.PORT || 8000;
const frontend = path.join(__dirname, '../frontend');
const projects = JSON.parse(fs.readFileSync(path.join(__dirname, 'projects.json'), 'utf8'));
const limiter = rate({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 500, // Limit each IP to 1000 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

// Search caching
let searchCache = {};

// Home page
app.get('/', (req, res) => {
    res.render('home');
});


// Handle transcripts
app.get('/transcript', (req, res) => {
    if (!req.url.endsWith('.html')) {
        if (!fs.existsSync(req.url)) {
            sendError(res, '404');
            return;
        }
        return;
    }
    let key = Object.keys(req.query)[0];
    if (key && key.length > 0) {
        try {
            let url = new URL(key);
            if (url.hostname !== 'cdn.discordapp.com') {
                sendError(res, '400', 'Invalid hostname.');
                return;
            }
        } catch (error) {
            sendError(res, '400', 'Invalid URL.');
            return;
        }
        fetch(key).then(response => {
            if (response.status !== 200) {
                throw response.status;
            }
            if (!response.headers.get("Content-Disposition").endsWith(".html, attachment")) {
                console.log("Attempted to parse an invalid html file " + response.headers.get("Content-Disposition"));
                throw 400;
            }
            return response.text();
        }).then(html => {
            return html.replace("<html>", "")
                .replace("</html>", "")
                .replace("<!DOCTYPE html>", "");
        }).then(html => {
            res.render('transcript', {transcript: html});
        }).catch(code => {
            sendError(res, code, 'That transcript is invalid or has expired.');
        });
        return;
    }
    sendError(res, '400', 'Bad request.');
});

// Serve the documentation index
app.get('/docs', (req, res) => {
    return res.render('docs-index');
});

// Serve documentation pages
app.get(['/docs/:name/(:page)?', '/docs/:name'], (req, res) => {
    // If the request ends with a forward slash, redirect to the same page without the forward slash
    if (req.url.endsWith('/')) {
        res.redirect(req.url.slice(0, -1));
        return;
    }

    // Serve page with markdown
    let name = req.params.name.toLowerCase();
    if (!req.params.page) {
        res.redirect(`/docs/${name}/Home`);
        return;
    }
    let page = req.params.page;

    // Find project with documentation by name
    let project = projects.find(project => project.name.toLowerCase() === name);
    if (!project) {
        sendError(res, '404', 'Invalid product.');
        return;
    }
    if (!project.documentation) {
        sendError(res, '404', 'There are no documentation pages for this product.');
        return;
    }

    // Send the page
    let pagePath = path.join(frontend, `docs/${name.toLowerCase()}/${page}.md`);
    if (fs.existsSync(pagePath)) {
        let sidebarPath = path.join(frontend, `docs/${name.toLowerCase()}/_Sidebar.md`);
        if (fs.existsSync(sidebarPath)) {
            res.render('docs', {
                projectName: project.name,
                pageName: page.replace(/-/g, ' '),
                navigation: markdown.render(fs.readFileSync(sidebarPath, 'utf8')),
                markdown: markdown.render(fs.readFileSync(pagePath, 'utf8'))
            });
        }
    } else {
        sendError(res, '404', 'Documentation page not found.');
    }
});


// Handle post requests to update project documentation
app.post('/api/update-docs', (req, res) => {
    const name = req.body.name;
    const repository = req.body.repository;
    if (name && repository) {
        // Validate that projects contains the project
        if (projects.find(project => project.repository === repository && project.name.toLowerCase() === name.toLowerCase())) {
            updateDocs(repository, name);
            res.status(200).send('OK');
        }

        // Clear the search cache
        searchCache = {};
    }
    res.status(400).send('Bad request');
});


// Search for matches of the query in the read page string
const searchPage = (query, markdown) => {
    let matches = [];
    let regex = new RegExp(query, 'gi');
    let match = regex.exec(markdown);
    while (match) {
        matches.push(match.index);
        match = regex.exec(markdown);
    }
    return matches;
}


// Serves a list of search results for a query term
app.get(['/api/search-docs/(:name)?', '/api/search-docs'], (req, res) => {
    const query = req.query.query;
    if (!query) {
        res.status(400).send('Bad request');
        return;
    }
    let projectsToSearch = [];
    const queryName = req.params.name;
    if (queryName) {
        const project = projects.find(project => project.name.toLowerCase() === queryName.toLowerCase());
        if (!project) {
            res.status(400).send('Project ' + queryName + ' not found');
            return;
        }
        if (!project.documentation) {
            res.status(400).send('No documentation found.');
            return;
        }
        projectsToSearch.push(project);
    } else {
        projectsToSearch = projects.filter(project => project.documentation);
    }
    if (projectsToSearch.length === 0) {
        res.status(400).send('No documentation found.');
        return;
    }

    // If the query is in the cache, return the cached results
    if (searchCache[query.toLowerCase()]) {
        // ...But only if the query was for the same projectsToSearch
        if (searchCache[query.toLowerCase()].projects.length === projectsToSearch.length) {
            let sameProjects = true;
            for (let i = 0; i < projectsToSearch.length; i++) {
                if (searchCache[query.toLowerCase()].projects[i].name !== projectsToSearch[i].name) {
                    sameProjects = false;
                    break;
                }
            }
            if (sameProjects) {
                res.status(200).send(searchCache[query.toLowerCase()].results);
                return;
            }
        }
    }

    const results = [];
    for (let project of projectsToSearch) {
        // List page names that end with .md from the frontend
        const pages = fs.readdirSync(path.join(frontend, `docs/${project.name.toLowerCase()}`));
        for (const page of pages) {
            if (page.endsWith('.md')) {
                // Search against the page name and content
                let pageName = page.slice(0, -3);
                let nameMatches = searchPage(query, pageName);
                let contentMatches = searchPage(query, fs.readFileSync(path.join(frontend, `docs/${project.name.toLowerCase()}/${page}`), 'utf8'));

                // Ignore meta pages (_Sidebar, _Footer & Home)
                if (pageName.startsWith('_') || pageName === 'Home') {
                    continue;
                }

                // Add the page to the results if it contains the query
                if (nameMatches.length + contentMatches.length > 0) {
                    results.push({
                        'project': project.name,
                        'name': pageName.replace(/-/g, ' '),
                        'url': `/docs/${project.name.toLowerCase()}/${pageName}`,
                        'name_matches': nameMatches.length,
                        'content_matches': contentMatches.length,
                    });
                }
            }
        }
    }

    // Cache the result for this query
    searchCache[query.toLowerCase()] = {
        'projects': projectsToSearch,
        'results': results,
    };

    res.send(results);
});


// Serves a list of all projects and data
app.get('/api/projects', (req, res) => {
    res.send(projects);
});


// Serves data about a specific project by name
app.get('/api/projects/:name', (req, res) => {
    const name = req.params.name;
    const project = projects.find(project => project.name.toLowerCase() === name.toLowerCase());
    if (project) {
        res.send(project);
    } else {
        res.status(404).send('Not found');
    }
});

// Serves data about the latest version of a specific project by name via Spiget
app.get('/api/projects/:name/version', (req, res) => {
    const project = projects.find(project => project.name.toLowerCase() === req.params.name.toLowerCase());
    if (project) {
        let id = project.ids.spigot;
        if (id) {
            spiget.getLatestResourceVersion(id).then(resource => {
                res.send({
                    name: project.name, version: resource.name, date: resource.releaseDate
                });
            });
        } else {
            res.status(400).send('No Spigot ID for project');
        }
    } else {
        res.status(404).send('Not found');
    }
});

// Prepare the sitemap and server settings
app.use(express.static(frontend));
app.use(['/api/projects', '/api/projects/:name', '/api/projects/:name/version', '/api/update-docs'], limiter);
let map = sitemap({generate: app});

// Handle sitemap requests
app.get('/sitemap.xml', (req, res) => {
    map.XMLtoWeb(res);
});

// Handle robots.txt requests
app.get('/robots.txt', (req, res) => {
    map.TXTtoWeb(res);
});


// Handle all other page requests
app.get('*', (req, res) => {
    let fullUrl = path.join(frontend, req.url);
    let urlModifiers = '';

    // If the request ends with a forward slash, redirect to the same page without the forward slash
    if (req.url.endsWith('/')) {
        res.redirect(req.url.slice(0, -1));
        return;
    }

    // If the file doesn't exist, serve the 404 page
    if (!fs.existsSync(fullUrl)) {
        if (!fs.existsSync(fullUrl + '.md')) {
            sendError(res, '404');
            return;
        } else {
            urlModifiers = '.md';
        }
    }

    // If the file is a .md (Markdown) readme file, parse it and serve it as HTML
    if (fullUrl.endsWith('.md') || urlModifiers === '.md') {
        res.render('readme', {
            name: req.url.replace(/-/g, ' ').substring(1, req.url.length),
            markdown: markdown.render(fs.readFileSync(path.join(frontend, req.url + urlModifiers), 'utf8'))
        })
    } else {
        res.sendFile(req.url + urlModifiers, {root: frontend});
    }
});


// Display an error page with a code and description
const sendError = (res, code, description) => {
    res.render('error', {
        'code': code,
        'description': description ? description : 'Make sure you entered the correct URL.'
    });
}


// Updates plugin documentation
const updateDocs = (repository, name) => {
    let wiki = repository + '.wiki.git';
    const filePath = path.join(frontend, `docs/${name.toLowerCase()}`);
    git(wiki, filePath, function (err) {
        if (err) {
            console.error('An error occurred pulling ' + wiki + ' to ' + filePath)
            console.error(err);
            return;
        }
        console.log('Updated project documentation for ' + name);
    });
}


// Update all project documentation
console.log('Updating project documentation...');
projects.filter(project => project.documentation).forEach(project => {
    updateDocs(project.repository, project.name);
});


// Serve the web application
app.set('view engine', 'pug');
app.set('views', 'backend/views')
app.listen(port, host, () => {
    console.log(`Server running at on ${host}:${port}`);
    console.log('[Pterodactyl] Ready');
});