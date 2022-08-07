const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const git = require('git-clone-or-pull');
const rate = require('express-rate-limit');
const mineget = require('mineget');

// Sitemap and robots.txt
const robots = require('express-robots-txt');
const {SitemapStream} = require('sitemap');
const {createGzip} = require('zlib')

// GitHub flavoured Markdown parsing
const MarkdownIt = require('markdown-it');
const markdown = new MarkdownIt({
    html: true, xhtmlOut: true
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
const domain = process.env.DOMAIN || 'https://william278.net';
const projects = JSON.parse(fs.readFileSync(path.join(__dirname, 'projects.json'), 'utf8'));
const platforms = JSON.parse(fs.readFileSync(path.join(__dirname, 'platforms.json'), 'utf8'));
const limiter = rate({
    windowMs: 10 * 60 * 100, // 1 minute
    max: 500, // Limit each IP to 1000 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
const ORGANIZATION = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "url": domain,
    "logo": domain + "/assets/icons/huskhelp.png",
});

// Redirect trailing forward slashes
app.use((req, res, next) => {
    if (req.path.substring(-1) === '/' && req.path.length > 1) {
        const query = req.url.slice(req.path.length)
        const safePAge = req.path.slice(0, -1).replace(/\/+/g, '/')
        res.redirect(301, safePAge + query)
    } else {
        next()
    }
})

const content = path.join(__dirname, 'content');
const readmes = path.join(__dirname, 'readmes');
const fontawesome = path.join(__dirname, 'node_modules', '@fortawesome');
app.use(express.static(content));
app.use(express.static(fontawesome));

app.set('view engine', 'pug');
app.set('views', 'pages')

// Robots.txt setup
app.use(robots({
    UserAgent: '*',
    Disallow: '/api/',
    CrawlDelay: '5',
    Sitemap: domain + '/sitemap.xml',
}));

// Rate limiter setup
app.use('/api', limiter);

// Get current git head version
const version = require('child_process')
    .execSync('git rev-parse HEAD')
    .toString().trim().substring(0, 7);

// Returns a formatted stat
const getFormattedStat = (stat, value) => {
    stat = stat.toLowerCase();
    switch (stat) {
        case 'total_downloads': {
            return {
                id: stat,
                icon: 'fa-solid fa-download',
                text: parseInt(value) > 1000 ? (parseInt(value) / 1000).toFixed(1) + 'k' : parseInt(value),
            };
        }
        case 'average_rating': {
            return {
                id: stat,
                icon: 'fa-solid fa-star',
                text: parseFloat(value).toFixed(1),
            };
        }
        case 'latest_version': {
            return {
                id: stat,
                icon: 'fa-solid fa-code-branch',
                text: value,
            };
        }
        default: {
            return undefined;
        }
    }
}

// Returns the readme of a project
let cachedReadmes = {};
const getProjectReadme = (project) => {
    let readMeFile = project['readme'];
    if (cachedReadmes[project.id]) {
        return new Promise((resolve) => {
            resolve(cachedReadmes[project.id]);
        });
    }
    if (readMeFile && readMeFile.startsWith('/')) {
        if (!readMeFile.endsWith('.md')) {
            readMeFile += '.md';
        }
        if (fs.existsSync(path.join(readmes, readMeFile))) {
            return new Promise((resolve) => {
                cachedReadmes[project.id] = fs.readFileSync(path.join(readmes, readMeFile), 'utf8');
                resolve(cachedReadmes[project.id]);
            });
        }
    }
    if (project['repository']) {
        const repository = project['repository'];
        // Fetch the raw readme from the repository
        return fetch(repository + '/raw/master/README.md').then(res => {
            if (res.status !== 200) {
                throw new Error('Readme not found');
            }
            return res.text()
        }).then(text => {
            // Replace relative links with absolute links to raw repository equivalent
            return text.replace(/]\((?!http)(.*?)\)/g, '](' + repository + '/raw/master/$1)');
        }).then(readme => {
            cachedReadmes[project.id] = readme;
            return readme;
        }).catch(() => {
            return undefined;
        });
    }
    return new Promise((resolve) => {
        resolve(undefined);
    });
};

// Returns data for a project box
const getProjectBox = (project) => {
    let projectData = {};

    // Prepare project name and description
    projectData['id'] = project['id'];
    projectData['name'] = project['name'];
    projectData['description'] = project['tagline'];

    // Prepare project tags
    if (project['tags']) {
        projectData['pills'] = project['tags'];
    }

    // Prepare project icon
    if (project['icon']) {
        if (project['icon']['svg']) {
            projectData['icon'] = {
                'url': '/assets/icons/' + project['icon']['svg'],
                'type': 'svg'
            }
        } else if (project['icon']['png']) {
            projectData['icon'] = {
                'url': '/assets/icons/' + project['icon']['png'],
                'type': 'png'
            }
        }
    }

    // Prepare platform icons
    projectData['buttons'] = [];
    if (project['repository']) {
        projectData['buttons'].push({
            'id': 'github',
            'name': platforms['github']['name'],
            'class': platforms['github']['icon'],
            'link': project['repository']
        })
    }
    if (project['ids']) {
        Object.entries(project['ids']).forEach(entry => {
            projectData['buttons'].push({
                'id': entry[0],
                'name': platforms[entry[0]]['name'],
                'class': platforms[entry[0]]['icon'],
                'link': platforms[entry[0]]['url'].toString().replace('{id}', entry[1])
            });
        });
    }

    // Prepare asset assets
    projectData.assets = project.assets;

    // Prepare page links
    projectData['links'] = [];
    if (project['documentation']) {
        projectData['links'].push({
            'id': 'documentation',
            'text': 'Docs',
            'link': '/docs/' + project['id'],
        })
    }
    if (project['readme']) {
        projectData['links'].push({
            'id': 'readme',
            'text': 'About',
            'link': '/project/' + project['id']
        })
    }

    // Prepare project stats if this is a plugin
    if (project['tags'] && projectStats[project['id']]) {
        if ((project['tags']).includes('plugin')) {
            projectData['stats'] = {};
            projectData['stats']['raw'] = projectStats[project['id']];
            projectData['stats']['formatted'] = [];
            for (const stat of Object.entries(projectStats[project['id']])) {
                let formatted = getFormattedStat(stat[0], stat[1]);
                if (formatted) {
                    projectData['stats']['formatted'].push(formatted);
                }
            }
        }
    }

    // Set if this project has a readme
    if (project['repository'] || project['readme']) {
        projectData['project_page'] = '/project/' + project['id'];
    }
    return projectData;
};

// Prepares project box data for the homepage
const getProjectBoxes = () => {
    let projectBoxData = [];
    for (const project of projects) {
        projectBoxData.push(getProjectBox(project));
    }
    return projectBoxData;
};

// Serve a page
const servePage = (req, res, page, options) => {
    const data = {
        'organization': ORGANIZATION,
        'version': version,
        'domain': domain,
        'path': req.path.slice(1),
        'name': 'William278.net',
        'title': 'Open source Minecraft server software & game projects - William278.net',
        'tagline': 'Open source Minecraft server software & game projects',
        'description': 'Easily-accessible documentation and information site for all of William278\'s Minecraft plugins, projects & games',
    };
    if (options) {
        Object.assign(data, options);
    }
    res.render(page, data);
}

// Home page
app.get('/', (req, res) => {
    servePage(req, res, 'home', {
        'projects': getProjectBoxes()
    });
});

// Redirect /project/ to the home page
app.get('/project', (req, res) => {
    res.redirect('/');
});

// Terms page
app.get('/terms', (req, res) => {
    servePage(req, res, 'readme', {
        'markdown': markdown.render(fs.readFileSync(path.join(readmes, 'terms.md'), 'utf8'))
    });
});

// Project pages
app.get('/project/:name', (req, res) => {
    const project = projects.find(project => project['id'] === req.params.name);
    if (!project || !(project['repository'] || project['readme'])) {
        sendError(req, res, 404, 'Project not found');
        return;
    }
    getProjectReadme(project).then(readme => {
        if (!readme) {
            sendError(req, res, 500, 'Server error: Unable to retrieve project README');
            return;
        }
        servePage(req, res, 'project', {
            'project': getProjectBox(project),
            'name': `${project['name']} - William278.net`,
            'title': `${project['tagline']} - ${project['name']} - William278.net`,
            'description': `About ${project['name']} on William278.net - ${project['tagline']}`,
            'markdown': markdown.render(readme)
        });
    });

});

// Handle transcripts
app.get('/transcript', (req, res) => {
    if (!req.url.endsWith('.html')) {
        if (!fs.existsSync(req.url)) {
            sendError(req, res, '404');
            return;
        }
        return;
    }
    let key = Object.keys(req.query)[0];
    if (key && key.length > 0) {
        try {
            let url = new URL(key);
            if (url.hostname !== 'cdn.discordapp.com') {
                sendError(req, res, '400', 'Invalid hostname.');
                return;
            }
        } catch (error) {
            sendError(req, res, '400', 'Invalid URL.');
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
            servePage(req, res, 'transcript', {
                'transcript': html,
                'name': `View Transcript - William278.net`,
                'title': `View HuskHelp Support Ticket Transcript (${key.split('/').pop()}) - William278.net`,
                'description': `Read a transcript of this HuskHelp Discord support ticket (${key.split('/').pop()}), including messages and attachments`
            });
        }).catch(code => {
            sendError(req, res, code, 'That transcript is invalid or has expired.');
        });
        return;
    }
    sendError(req, res, '400', 'Bad request.');
});

// Serve the documentation index
app.get('/docs', (req, res) => {
    servePage(req, res, 'docs-index', {
        'name': 'Documentation - William278.net',
        'title': 'Documentation for HuskHomes, HuskSync & more - William278.net',
        'description': 'Documentation for William278\'s various projects, including HuskHomes, HuskSync, HuskTowns & HuskChat.',
    });
});

// Serve documentation pages
app.get('/docs/:name/(:page)?', (req, res) => {
    // Get the project name and page specified
    let projectName = (req.params['name']);
    if (!projectName || projectName === '') {
        sendError(req, res, '404', 'Project not found');
        return;
    }
    projectName = projectName.toLowerCase();

    let pageName = (req.params['page'])
    if (!pageName || pageName === '') {
        res.redirect(`/docs/${projectName}/Home`);
        return;
    }

    // Find project with documentation by name
    let project = projects.find(project => project.name.toLowerCase() === projectName);
    if (!project) {
        sendError(req, res, '404', 'Invalid project.');
        return;
    }
    if (!project.documentation) {
        sendError(req, res, '404', 'There are no documentation pages for this project.');
        return;
    }

    // Send the page
    let pagePath = path.join(content, `docs/${projectName.toLowerCase()}/${pageName}.md`);
    if (fs.existsSync(pagePath)) {
        let sidebarPath = path.join(content, `docs/${projectName.toLowerCase()}/_Sidebar.md`);
        if (fs.existsSync(sidebarPath)) {
            let pageTitle = pageName.replace(/-/g, ' ');
            servePage(req, res, 'docs', {
                'projectName': project.name,
                'pageName': pageTitle,
                'name': `${project.name} Docs - ${pageTitle} -  William278.net`,
                'navigation': markdown.render(fs.readFileSync(sidebarPath, 'utf8')),
                'markdown': markdown.render(fs.readFileSync(pagePath, 'utf8')),
                'title': `${project.name} Documentation - ${pageTitle} - William278.net`,
                'description': `Documentation for ${project.name} - ${project['tagline']} - ${pageTitle}`,
            });
        }
    } else {
        sendError(req, res, '404', 'Documentation page not found.');
    }
});

// Handle post requests to update project documentation
let searchCache = {};
app.post('/api/update-docs', (req, res) => {
    const id = req.body['name'];
    const repository = req.body['repository'];
    if (id && repository) {
        // Validate that projects contains the project
        if (projects.find(project => project['repository'] === repository && project.id.toLowerCase() === id.toLowerCase())) {
            updateDocs(repository, id);
            res.status(200).send('OK');
            searchCache = {}; // Clear the search cache
        }
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
    // Limit query size to 32
    if (query.length > 32) {
        res.status(400).send('Query too long');
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
        // List page names that end with .md from the content
        const pages = fs.readdirSync(path.join(content, `docs/${project.name.toLowerCase()}`));
        for (const page of pages) {
            if (page.endsWith('.md')) {
                // Search against the page name and content
                let pageName = page.slice(0, -3);
                let nameMatches = searchPage(query, pageName);
                let contentMatches = searchPage(query, fs.readFileSync(path.join(content, `docs/${project.name.toLowerCase()}/${page}`), 'utf8'));

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

    // Sort results by name matches first, followed by content matches
    results.sort((a, b) => {
        if (a.name_matches === b.name_matches) {
            return b.content_matches - a.content_matches;
        }
        return b.name_matches - a.name_matches;
    });

    // Limit to first 15 results
    results.splice(15);

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

// Get statistics about a project
let projectStats = {};
const getProjectStats = async () => {
    let stats = {};
    for (const project of projects) {
        if (!project.tags) continue;
        if (!project.tags.includes('plugin')) continue;
        if (project['ids']) {
            stats[project.id] = await mineget.get(project['ids']);
        }
    }
    return stats;
}
app.get('/api/stats', (req, res) => {
    res.send(projectStats);
    getProjectStats().then(stats => {
        projectStats = stats;
    });
});

app.get('/api/stats/:name', (req, res) => {
    if (!req.params.name) {
        res.status(400).send('No project specified');
        return;
    }
    let project = projects.find(project => project.id.toLowerCase() === req.params.name.toLowerCase());
    if (!project) {
        res.status(404).send('Invalid project');
        return;
    }
    if (!projectStats[project.id]) {
        res.status(400).send('No stats to return for this project');
        return;
    }

    res.send(projectStats[project.id]);
    getProjectStats().then(stats => {
        projectStats = stats;
    });
});

// Handle sitemap requests
let cachedSitemap;
app.get('/sitemap.xml', (req, res) => {
    res.header('Content-Type', 'application/xml');
    res.header('Content-Encoding', 'gzip');

    // Returned cached sitemap if it exists
    if (cachedSitemap) {
        res.send(cachedSitemap)
        return;
    }

    // Generate sitemap
    try {
        const sitemapStream = new SitemapStream({
            hostname: domain
        });
        const pipeline = sitemapStream.pipe(createGzip())

        // Write pages
        sitemapStream.write({
            url: '/',
            changefreq: 'daily',
            lastmod: new Date().toISOString(),
            priority: 1,
            img: {
                url: '/assets/icons/williamhead.png'
            }
        });
        sitemapStream.write({
            url: '/docs/',
            changefreq: 'daily',
            lastmod: fs.statSync(path.join('pages', 'home.pug')).mtime.toISOString(),
            priority: 0.9
        });

        // Iterate through every .md file in the content/docs directory and subdirectories
        for (const project of projects) {
            if (project['repository'] && project['documentation']) {
                for (const page of fs.readdirSync(path.join(content, `docs/${project.id}`))) {
                    if (page.endsWith('.md') && !page.startsWith('_') && page !== 'Home.md') {
                        let pageName = page.slice(0, -3);
                        if (project['icon'] && project['icon']['png']) {
                            sitemapStream.write({
                                url: `/docs/${project.id}/${pageName}`,
                                changefreq: 'daily',
                                lastmod: fs.statSync(path.join(content, `docs/${project.id}/${page}`)).mtime.toISOString(),
                                priority: 0.8,
                                img: {
                                    url: `/assets/icons/${project.icon.png}`
                                }
                            });
                        } else {
                            sitemapStream.write({
                                url: `/docs/${project.id}/${pageName}`,
                                changefreq: 'daily',
                                lastmod: fs.statSync(path.join(content, `docs/${project.id}/${page}`)).mtime.toISOString(),
                                priority: 0.8,
                            });
                        }
                    }
                }
            }

            if (project.readme || project.repository) {
                if (project['icon'] && project['icon']['png']) {
                    sitemapStream.write({
                        url: `/project/${project.id}`,
                        changefreq: 'daily',
                        priority: 0.9,
                        img: {
                            url: `/assets/icons/${project['icon']['png']}`,
                        }
                    });
                } else {
                    sitemapStream.write({
                        url: `/project/${project.id}`,
                        changefreq: 'daily',
                        priority: 0.9
                    });
                }
            }
        }

        sitemapStream.end();
        pipeline.pipe(res).on('error', (error) => {
            throw error;
        });
    } catch (error) {
        console.error(error)
        res.status(500).end('Internal error generating sitemap');
    }
});

// Handle robots.txt
app.get('/robots.txt', (req, res) => {
    res.send();
});

// Handle all other page requests
app.use((req, res) => {
    sendError(req, res, '404');
});


// Display an error page with a code and description
const sendError = (req, res, code, description) => {
    servePage(req, res, 'error', {
        'code': code,
        'details': description ? description : 'Make sure you entered the correct URL.',
        'title': `Error ${code} - William278.net`,
        'name': `Error ${code} - William278.net`,
        'description': `Error ${code} - ${description ? description : 'Make sure you entered the correct URL.'}`,
    });
}

// Updates plugin documentation
const updateDocs = (repository, id) => {
    let wiki = repository + '.wiki.git';

    // Check if the content /docs directory exists, if it does not create it
    if (!fs.existsSync(path.join(content, 'docs'))) {
        fs.mkdirSync(path.join(content, 'docs'));
    }

    // Pull docs from the wikis
    const filePath = path.join(content, `docs/${id.toLowerCase()}`);
    git(wiki, filePath, function (err) {
        if (err) {
            console.error('An error occurred pulling ' + wiki + ' to ' + filePath)
            console.error(err);
            return;
        }
        console.log('Updated project documentation for ' + id);
    });
}

// Update all project documentation
console.log('Updating project documentation...');
projects.filter(project => project['documentation']).forEach(project => {
    updateDocs(project['repository'], project['id']);
});

// Cache the project stats
console.log('Caching project stats...');
getProjectStats().then(stats => {
    projectStats = stats;
}).then(() => {
    console.log('Starting server...');
    app.listen(port, host, () => {
        console.log(`Server running at on ${host}:${port}`);
        console.log('[Pterodactyl] Ready');
    });
});