"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dashboard = void 0;
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const path_1 = __importDefault(require("path"));
const config_1 = __importDefault(require("../config"));
const fs_1 = require("fs");
const path_2 = require("path");
const express_ejs_layouts_1 = __importDefault(require("express-ejs-layouts"));
const discord_js_1 = require("discord.js");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const welcomeManager_1 = require("../src/welcome/welcomeManager");
const velaMap_1 = require("./velaMap");
const applicationModel_1 = require("../src/models/Application");
const ticketModel_1 = require("../src/models/Ticket");
class Dashboard {
    constructor(client) {
        this.client = client;
        this.locales = {};
        this.app = (0, express_1.default)();
        this.startTime = new Date();
        this.loadLocales();
        this.setup();
        this.routes();
    }
    loadLocales() {
        const fallbackLocale = {
            dashboard: {
                title: 'Dashboard',
                settings: { title: 'Bot Settings' },
                commands: { title: 'Commands', general: 'General', moderation: 'Moderation', utility: 'Utility' },
                commandDescriptions: {},
                logs: { title: 'Logging' },
                protection: { title: 'Protection' },
                tickets: { title: 'Tickets' },
                apply: { title: 'Applications' },
                rules: { title: 'Rules' },
                giveaway: { title: 'Giveaways' },
                tempChannels: { title: 'Temporary Channels' },
                autoReply: { title: 'Auto Reply' },
                suggestions: { title: 'Suggestions' },
                welcome: { title: 'Welcome' },
                error: { '404': { title: 'Not Found', message: 'The page you requested could not be found.' } }
            },
            docs: { title: 'Documentation' }
        };
        this.fallbackLocale = fallbackLocale;
        try {
            const localesPath = path_1.default.join(__dirname, 'locales');
            const loadFile = (name) => {
                try {
                    const filePath = path_1.default.join(localesPath, `${name}.json`);
                    if (!(0, fs_1.existsSync)(filePath)) {
                        console.warn(`Dashboard locale missing, using fallback: ${filePath}`);
                        return null;
                    }
                    return JSON.parse((0, fs_1.readFileSync)(filePath, 'utf-8'));
                }
                catch (e) {
                    console.error(`Error loading dashboard locale ${name}:`, e.message);
                    return null;
                }
            };
            const en = loadFile('en');
            const ar = loadFile('ar');
            if (en)
                this.locales.en = en;
            if (ar)
                this.locales.ar = ar;
            if (!this.locales.en)
                this.locales.en = fallbackLocale;
            if (!this.locales.ar)
                this.locales.ar = this.locales.en;
        }
        catch (error) {
            console.error('Error loading dashboard locales:', error);
            if (!this.locales.en)
                this.locales.en = fallbackLocale;
            if (!this.locales.ar)
                this.locales.ar = this.locales.en;
        }
    }
    getLocale(lang = 'en') {
        return this.locales[lang] || this.locales['en'] || this.fallbackLocale || { dashboard: { title: 'Dashboard' }, docs: { title: 'Documentation' } };
    }
    getUptime() {
        const now = new Date();
        const diff = now.getTime() - this.startTime.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (days > 0)
            return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0)
            return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }
    getPing() {
        return Math.round(this.client.ws.ping);
    }
    getBreadcrumbs(path) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length === 0)
            return 'Dashboard';
        return parts.map((part, index) => {
            const isLast = index === parts.length - 1;
            const formattedPart = part.charAt(0).toUpperCase() + part.slice(1);
            return isLast ? formattedPart : `${formattedPart} /`;
        }).join(' ');
    }
    setup() {
        this.app.set('view engine', 'ejs');
        this.app.set('views', path_1.default.join(__dirname, 'views'));
        this.app.use(express_ejs_layouts_1.default);
        this.app.set('layout', false);
        this.app.set('layout extractScripts', false);
        this.app.set('layout extractStyles', false);
        this.app.use((req, res, next) => {
            res.locals = {
                ...res.locals,
                locale: this.getLocale(res.locals.currentLang),
                path: req.path,
                currentLang: res.locals.currentLang || 'en',
                title: 'Dashboard',
                renderPartial: (name) => {
                    try {
                        const partialPath = path_1.default.join(__dirname, 'views', 'partials', `${name}.ejs`);
                        return require('ejs').render(require('fs').readFileSync(partialPath, 'utf8'), res.locals);
                    }
                    catch (error) {
                        console.error(`Error rendering partial ${name}:`, error);
                        return `<div class="error">Error loading ${name}</div>`;
                    }
                }
            };
            next();
        });
        // Never cache dashboard pages or scripts: always serve the latest UI
        this.app.use((req, res, next) => {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.set('Pragma', 'no-cache');
            next();
        });
        this.app.use(express_1.default.static(path_1.default.join(__dirname, 'public')));
        this.app.use((req, res, next) => {
            res.locals.path = req.path;
            next();
        });
        const isProduction = process.env.NODE_ENV === 'production';
        this.app.use((0, express_session_1.default)({
            secret: config_1.default.dashboard.secret,
            resave: false,
            saveUninitialized: false,
            cookie: { secure: isProduction }
        }));
        this.app.use(express_1.default.json({ limit: '25mb' }));
        this.app.use(express_1.default.urlencoded({ limit: '25mb', extended: true }));
        this.app.use((0, cookie_parser_1.default)());
        this.app.use((req, res, next) => {
            const lang = req.query.lang ||
                req.cookies?.preferredLanguage ||
                'en';
            const validLang = ['en', 'ar'].includes(lang) ? lang : 'en';
            res.cookie('preferredLanguage', validLang, {
                maxAge: 365 * 24 * 60 * 60 * 1000,
                httpOnly: false,
                path: '/',
                secure: isProduction
            });
            res.locals.locale = this.getLocale(validLang);
            res.locals.currentLang = validLang;
            res.setHeader('Content-Language', validLang);
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId) || this.client.guilds.cache.first();
                res.locals.guildInfo = guild
                    ? { name: guild.name, icon: (typeof guild.iconURL === 'function' ? guild.iconURL({ size: 128 }) : null) }
                    : { name: 'Dashboard', icon: null };
            }
            catch (e) {
                res.locals.guildInfo = { name: 'Dashboard', icon: null };
            }
            try {
                res.locals.sessionUser = (req.session && req.session.user) || null;
            }
            catch (e) {
                res.locals.sessionUser = null;
            }
            next();
        });
        this.app.use((req, res, next) => {
            res.locals.ping = this.getPing();
            res.locals.uptime = this.getUptime();
            res.locals.path = req.path;
            res.locals.breadcrumbs = this.getBreadcrumbs(req.path);
            next();
        });
    }
    routes() {
        // ---- Discord OAuth2 login ----
        const OAUTH_SCOPES = 'identify guilds';
        this.app.get('/login', (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            if (_req.session?.user) {
                return res.redirect('/');
            }
            return res.render('login', {
                title: currentLang === 'ar' ? 'تسجيل الدخول' : 'Login',
                settings: this.client.settings,
                bot: this.client,
                config: config_1.default,
                path: '/login',
                currentLang,
                locale,
                breadcrumbs: this.getBreadcrumbs('/login'),
                oauthReady: !!(config_1.default.clientId && config_1.default.dashboard && config_1.default.dashboard.clientSecret && config_1.default.dashboard.callbackUrl)
            });
        });
        this.app.get('/auth/discord', (_req, res) => {
            const dash = config_1.default.dashboard || {};
            const clientId = config_1.default.clientId;
            if (!clientId || !dash.callbackUrl) {
                return res.status(500).send('Dashboard OAuth is not configured (clientId/callbackUrl).');
            }
            const url = 'https://discord.com/oauth2/authorize' +
                '?client_id=' + encodeURIComponent(clientId) +
                '&redirect_uri=' + encodeURIComponent(dash.callbackUrl) +
                '&response_type=code&scope=' + encodeURIComponent(OAUTH_SCOPES) +
                '&prompt=none';
            return res.redirect(url);
        });
        this.app.get('/auth/callback', async (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            const fail = (code, message) => res.status(code).render('error', {
                title: 'Error',
                error: { code, message },
                currentLang,
                locale,
                path: '/auth/callback'
            });
            try {
                if (_req.query.error) {
                    return fail(400, 'Discord login was cancelled (' + _req.query.error + ').');
                }
                const code = _req.query.code;
                if (!code) {
                    return fail(400, 'Missing login code from Discord.');
                }
                const dash = config_1.default.dashboard || {};
                if (!dash.clientSecret) {
                    return fail(500, 'Login is not configured yet: set dashboard.clientSecret in dist/config.js (Discord Developer Portal → OAuth2 → Client Secret), register the redirect URL ' + (dash.callbackUrl || '') + ' in the portal, then restart the bot.');
                }
                const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: config_1.default.clientId,
                        client_secret: dash.clientSecret,
                        grant_type: 'authorization_code',
                        code: String(code),
                        redirect_uri: dash.callbackUrl
                    })
                });
                const tokenData = await tokenRes.json().catch(() => ({}));
                if (!tokenRes.ok || !tokenData.access_token) {
                    return fail(400, 'Login exchange failed: ' + (tokenData.error_description || tokenData.error || ('HTTP ' + tokenRes.status)));
                }
                const authz = (tokenData.token_type || 'Bearer') + ' ' + tokenData.access_token;
                const meRes = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: authz } });
                const me = await meRes.json().catch(() => ({}));
                if (!meRes.ok || !me.id) {
                    return fail(400, 'Could not read your Discord profile.');
                }
                const gRes = await fetch('https://discord.com/api/v10/users/@me/guilds', { headers: { Authorization: authz } });
                const guilds = await gRes.json().catch(() => []);
                const g = Array.isArray(guilds) ? guilds.find((x) => x && x.id === config_1.default.mainGuildId) : null;
                if (!g) {
                    return fail(403, 'Your Discord account is not a member of this server.');
                }
                let perms = 0n;
                try {
                    perms = BigInt(g.permissions || '0');
                }
                catch (e) { perms = 0n; }
                const allowed = g.owner === true || (perms & 0x8n) !== 0n || (perms & 0x20n) !== 0n;
                if (!allowed) {
                    return fail(403, 'You need Manage Server permission in this server to open the dashboard.');
                }
                const avatar = me.avatar
                    ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128`
                    : `https://cdn.discordapp.com/embed/avatars/${Number(me.discriminator || 0) % 5}.png`;
                _req.session.user = {
                    id: me.id,
                    username: me.username,
                    globalName: me.global_name || me.username,
                    avatar
                };
                return res.redirect('/');
            }
            catch (error) {
                console.error('OAuth callback error:', error);
                return fail(500, 'Login failed: ' + (error.message || 'unknown error'));
            }
        });
        this.app.get('/logout', (_req, res) => {
            try {
                _req.session.destroy(() => { });
            }
            catch (e) { }
            return res.redirect('/login');
        });
        // ---- Require login for everything below (public landing excluded) ----
        this.app.use((req, res, next) => {
            if (req.path === '/' || req.path === '/login' || req.path.startsWith('/auth/')) {
                return next();
            }
            if (req.session?.user) {
                return next();
            }
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ error: 'Login required' });
            }
            return res.redirect('/auth/discord');
        });
        // ---- Vela frontend (new dashboard UI; old EJS removed) ----
        this.app.get('/login', (_req, res) => {
            return res.redirect('/auth/discord');
        });
        this.app.get('/', (_req, res) => {
            try {
                const inviteUrl = 'https://discord.com/oauth2/authorize?client_id=' + config_1.default.clientId + '&permissions=8&scope=bot%20applications.commands';
                return res.render('landing', {
                    inviteUrl,
                    commands: velaMap_1.COMMANDS.map(([name, description]) => ['/' + name, description]),
                    layout: false
                });
            }
            catch (error) {
                console.error('Error rendering landing:', error);
                return res.status(500).send('Failed to load page.');
            }
        });
        this.app.get('/dashboard', (_req, res) => {
            try {
                return res.render('vela', { layout: false });
            }
            catch (error) {
                console.error('Error rendering dashboard:', error);
                return res.status(500).send('Failed to load dashboard.');
            }
        });
        // Logging lives in the new Vela SPA tab — link it, don't re-render it.
        this.app.get('/logs', (_req, res) => res.redirect('/dashboard#logging'));
        // Case alias only; every other path has a real new-design template below.
        this.app.get('/tempchannels', (_req, res) => res.redirect('/tempChannels'));
        const guildLists = async () => {
            const guild = this.client.guilds.cache.get(config_1.default.mainGuildId) || this.client.guilds.cache.first();
            if (!guild)
                throw new Error('Guild not found');
            const channels = guild.channels.cache
                .filter((c) => typeof c.isTextBased === 'function' && c.isTextBased())
                .map((c) => ({ id: c.id, name: c.name }));
            const roles = guild.roles.cache
                .filter((r) => r.id !== guild.id)
                .map((r) => ({ id: r.id, name: r.name }));
            const categories = guild.channels.cache
                .filter((c) => c.type === discord_js_1.ChannelType.GuildCategory)
                .map((c) => ({ id: c.id, name: c.name }));
            return { guild, channels, roles, categories };
        };
        this.app.get('/api/vela/boot', async (_req, res) => {
            try {
                const { guild, channels, roles, categories } = await guildLists();
                const state = velaMap_1.stateFromSettings(this.client.settings, { channels });
                const inviteUrl = 'https://discord.com/oauth2/authorize?client_id=' + config_1.default.clientId + '&permissions=8&scope=bot%20applications.commands';
                return res.json({
                    user: _req.session.user,
                    guild: { id: guild.id, name: guild.name, icon: (typeof guild.iconURL === 'function' ? guild.iconURL({ size: 128 }) : null) },
                    channels,
                    roles,
                    categories,
                    state,
                    inviteUrl,
                    stats: {
                        members: guild.memberCount,
                        servers: this.client.guilds.cache.size,
                        ping: Math.round(this.client.ws.ping)
                    }
                });
            }
            catch (error) {
                console.error('Error building vela boot:', error);
                return res.status(500).json({ error: 'Failed to load dashboard data' });
            }
        });
        this.app.get('/api/vela/server-stats', async (_req, res) => {
            try {
                const { guild } = await guildLists();
                const gid = guild.id;
                const st = this.client.settings || {};
                const v = st.vela || {};
                let dbOn = false;
                try {
                    dbOn = require('mongoose').connection.readyState === 1;
                }
                catch (e) {
                    dbOn = false;
                }
                let messages = 0, voiceMinutes = 0, modActions = 0, net7d = 0;
                if (dbOn) {
                    try {
                        const { Activity } = require('../src/models/Activity');
                        const agg = await Activity.aggregate([
                            { $match: { guildId: gid } },
                            { $group: { _id: null, messages: { $sum: '$messages' }, voiceMs: { $sum: '$voiceMs' } } }
                        ]);
                        if (agg && agg[0]) {
                            messages = agg[0].messages || 0;
                            voiceMinutes = Math.round((agg[0].voiceMs || 0) / 60000);
                        }
                    }
                    catch (e) { }
                    try {
                        const { Punishment } = require('../src/models/Punishment');
                        const { Warning } = require('../src/models/Warning');
                        const [pc, wc] = await Promise.all([
                            Punishment.countDocuments({ guildId: gid }),
                            Warning.countDocuments({ guildId: gid })
                        ]);
                        modActions = (pc || 0) + (wc || 0);
                    }
                    catch (e) { }
                    try {
                        const { AnalyticsDay } = require('../src/models/AnalyticsDay');
                        const since = new Date();
                        since.setUTCDate(since.getUTCDate() - 7);
                        const rows = await AnalyticsDay.find({ guildId: gid, day: { $gte: since.toISOString().slice(0, 10) } }).lean();
                        net7d = rows.reduce((n, r) => n + (r.joins || 0) - (r.leaves || 0), 0);
                    }
                    catch (e) { }
                }
                const anyLog = !!(st.logs && Object.values(st.logs).some((l) => l && l.enabled));
                const mods = [
                    !!(st.welcome && st.welcome.enabled),
                    !!(st.autoRoles && st.autoRoles.enabled),
                    !!v.vOn, !!v.lvOn,
                    !!(st.ticket && st.ticket.enabled),
                    !!(st.apply && st.apply.enabled),
                    !!(st.rules && st.rules.enabled),
                    !!(st.giveaway && st.giveaway.enabled),
                    !!v.amOn, !!v.scRaid, anyLog,
                    !!v.rsOn,
                    !!(st.tempChannels && st.tempChannels.enabled),
                    !!(st.suggestions && st.suggestions.enabled),
                    !!(st.protection && st.protection.enabled)
                ];
                return res.json({
                    members: guild.memberCount || 0,
                    net7d, messages, voiceMinutes, modActions,
                    activeModules: mods.filter(Boolean).length,
                    totalModules: mods.length
                });
            }
            catch (error) {
                console.error('Error building server stats:', error);
                return res.status(500).json({ error: 'Failed to load server stats' });
            }
        });
        this.app.get('/api/vela/analytics', async (_req, res) => {
            try {
                const { guild } = await guildLists();
                const gid = guild.id;
                let period = parseInt(_req.query.period, 10);
                if (period !== 7 && period !== 30)
                    period = 7;
                const atMidnightUTC = (offset) => {
                    const d = new Date();
                    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset));
                };
                const days = [];
                for (let i = period - 1; i >= 0; i--)
                    days.push(atMidnightUTC(i).toISOString().slice(0, 10));
                const prevDays = [];
                for (let i = 2 * period - 1; i >= period; i--)
                    prevDays.push(atMidnightUTC(i).toISOString().slice(0, 10));
                const labels = days.map((k) => {
                    try {
                        return new Date(k + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
                    }
                    catch (e) {
                        return k;
                    }
                });
                let dbOn = false;
                try {
                    dbOn = require('mongoose').connection.readyState === 1;
                }
                catch (e) {
                    dbOn = false;
                }
                const zeros = () => days.map(() => 0);
                let joins = zeros(), leaves = zeros(), messages = zeros(), voiceMinutes = zeros();
                const hours = new Array(24).fill(0);
                const chanTot = {};
                // Real join history from cached members fills days with no collected rows yet.
                const cacheJoins = {};
                try {
                    for (const m of guild.members.cache.values()) {
                        if (m && m.joinedTimestamp) {
                            const k = new Date(m.joinedTimestamp).toISOString().slice(0, 10);
                            cacheJoins[k] = (cacheJoins[k] || 0) + 1;
                        }
                    }
                }
                catch (e) { }
                let pJ = 0, pL = 0, pM = 0, pV = 0;
                if (dbOn) {
                    try {
                        const { AnalyticsDay } = require('../src/models/AnalyticsDay');
                        const rows = await AnalyticsDay.find({ guildId: gid, day: { $gte: prevDays[0], $lte: days[days.length - 1] } }).lean();
                        const byDay = {};
                        rows.forEach((r) => {
                            if (r && r.day)
                                byDay[r.day] = r;
                        });
                        days.forEach((k, i) => {
                            const r = byDay[k];
                            if (r) {
                                joins[i] = r.joins || 0;
                                leaves[i] = r.leaves || 0;
                                messages[i] = r.messages || 0;
                                voiceMinutes[i] = Math.round((r.voiceMs || 0) / 60000);
                                if (Array.isArray(r.hours)) {
                                    r.hours.forEach((h, hh) => {
                                        if (hh >= 0 && hh < 24 && h > 0)
                                            hours[hh] += h;
                                    });
                                }
                                if (r.channels && typeof r.channels === 'object') {
                                    for (const [cid, n] of Object.entries(r.channels)) {
                                        if (n > 0)
                                            chanTot[cid] = (chanTot[cid] || 0) + n;
                                    }
                                }
                            }
                        });
                        prevDays.forEach((k) => {
                            const r = byDay[k];
                            if (r) {
                                pJ += r.joins || 0;
                                pL += r.leaves || 0;
                                pM += r.messages || 0;
                                pV += Math.round((r.voiceMs || 0) / 60000);
                            }
                        });
                    }
                    catch (e) { }
                }
                days.forEach((k, i) => {
                    joins[i] = Math.max(joins[i], cacheJoins[k] || 0);
                });
                const busiestChannels = Object.entries(chanTot)
                    .map(([id, count]) => {
                    const ch = guild.channels.cache.get(id);
                    return { id, name: ch ? ch.name : null, count };
                })
                    .filter((x) => x.count > 0)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5);
                let topMembers = [];
                if (dbOn) {
                    try {
                        const { Activity } = require('../src/models/Activity');
                        const rows = await Activity.find({ guildId: gid, $or: [{ messages: { $gt: 0 } }, { voiceMs: { $gt: 0 } }] }).sort({ messages: -1 }).limit(5).lean();
                        if (!this._tagCache)
                            this._tagCache = new Map();
                        topMembers = [];
                        for (const r of rows) {
                            const m = guild.members.cache.get(r.userId);
                            let tag = m ? m.user.tag : (this._tagCache.get(r.userId) || null);
                            if (!tag) {
                                try {
                                    const u = await this.client.users.fetch(r.userId);
                                    if (u) {
                                        tag = u.tag;
                                        this._tagCache.set(r.userId, tag);
                                    }
                                }
                                catch (e) { }
                            }
                            topMembers.push({ userId: r.userId, tag, messages: r.messages || 0, voiceMinutes: Math.round((r.voiceMs || 0) / 60000) });
                        }
                    }
                    catch (e) { }
                }
                let modBreakdown = [];
                if (dbOn) {
                    try {
                        const { Punishment } = require('../src/models/Punishment');
                        const { Warning } = require('../src/models/Warning');
                        const agg = await Punishment.aggregate([
                            { $match: { guildId: gid } },
                            { $group: { _id: '$type', count: { $sum: 1 } } },
                            { $sort: { count: -1 } }
                        ]);
                        modBreakdown = agg.map((a) => ({ type: a._id || 'other', count: a.count }));
                        const wc = await Warning.countDocuments({ guildId: gid });
                        if (wc)
                            modBreakdown.push({ type: 'warn', count: wc });
                        modBreakdown.sort((a, b) => b.count - a.count);
                    }
                    catch (e) { }
                }
                return res.json({
                    period, days, labels, joins, leaves, messages, voiceMinutes, hours,
                    prev: { joins: pJ, leaves: pL, messages: pM, voiceMinutes: pV },
                    topMembers, modBreakdown, busiestChannels
                });
            }
            catch (error) {
                console.error('Error building analytics:', error);
                return res.status(500).json({ error: 'Failed to load analytics' });
            }
        });
        this.app.post('/api/vela/upload', async (req, res) => {
            try {
                const { image } = req.body || {};
                if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
                    return res.status(400).json({ error: 'Invalid image data' });
                }
                const m = image.match(/^data:(image\/\w+);base64,/);
                if (!m) {
                    return res.status(400).json({ error: 'Invalid image data' });
                }
                const buf = Buffer.from(image.slice(m[0].length), 'base64');
                if (buf.length > 4 * 1048576) {
                    return res.status(400).json({ error: 'Image larger than 4 MB' });
                }
                const uploadsDir = (0, path_2.join)(__dirname, 'public', 'uploads');
                if (!(0, fs_1.existsSync)(uploadsDir)) {
                    (0, fs_1.mkdirSync)(uploadsDir, { recursive: true });
                }
                const fileName = `vela-${Date.now()}.png`;
                (0, fs_1.writeFileSync)((0, path_2.join)(uploadsDir, fileName), buf);
                return res.json({ success: true, url: '/uploads/' + fileName });
            }
            catch (error) {
                console.error('Error uploading vela image:', error);
                return res.status(500).json({ error: 'Failed to upload image' });
            }
        });
        this.app.post('/api/vela/cutout', async (req, res) => {
            try {
                const { image, imageUrl } = req.body || {};
                let buf = null;
                if (typeof image === 'string' && image.startsWith('data:image/')) {
                    const m = image.match(/^data:(image\/\w+);base64,/);
                    if (!m) {
                        return res.status(400).json({ error: 'Invalid image data' });
                    }
                    buf = Buffer.from(image.slice(m[0].length), 'base64');
                }
                else if (typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl)) {
                    const axios = require('axios');
                    const dl = await axios({ url: imageUrl, responseType: 'arraybuffer', timeout: 15000, maxContentLength: 4 * 1048576 });
                    const ct = String((dl.headers && dl.headers['content-type']) || '');
                    if (ct && !ct.startsWith('image/')) {
                        return res.status(400).json({ error: 'Link is not an image' });
                    }
                    buf = Buffer.from(dl.data);
                }
                else {
                    return res.status(400).json({ error: 'Provide an image or imageUrl' });
                }
                if (!buf || !buf.length || buf.length > 4 * 1048576) {
                    return res.status(400).json({ error: 'Image is empty or larger than 4 MB' });
                }
                let cutout;
                try {
                    cutout = require('../src/welcome/cutout');
                }
                catch (e) {
                    return res.status(500).json({ error: 'Background removal is not installed' });
                }
                const out = await cutout.cutoutBuffer(buf);
                return res.json({ success: true, image: 'data:image/png;base64,' + out.toString('base64') });
            }
            catch (error) {
                console.error('Error removing image background:', error.message || error);
                return res.status(500).json({ error: error.message || 'Failed to remove background' });
            }
        });
        this.app.post('/api/vela/save', async (req, res) => {
            try {
                const S = req.body && req.body.state;
                if (!S || typeof S !== 'object' || Array.isArray(S)) {
                    return res.status(400).json({ error: 'Invalid settings payload' });
                }
                for (const k of ['wImg', 'gImg', 'anImg']) {
                    if (typeof S[k] === 'string' && S[k].startsWith('data:image/')) {
                        const m = S[k].match(/^data:(image\/\w+);base64,/);
                        if (!m) {
                            return res.status(400).json({ error: 'Invalid image data' });
                        }
                        const buf = Buffer.from(S[k].slice(m[0].length), 'base64');
                        if (buf.length > 4 * 1048576) {
                            return res.status(400).json({ error: 'Image larger than 4 MB' });
                        }
                        const uploadsDir = (0, path_2.join)(__dirname, 'public', 'uploads');
                        if (!(0, fs_1.existsSync)(uploadsDir)) {
                            (0, fs_1.mkdirSync)(uploadsDir, { recursive: true });
                        }
                        const fileName = `vela-${Date.now()}-${k}.png`;
                        (0, fs_1.writeFileSync)((0, path_2.join)(uploadsDir, fileName), buf);
                        S[k] = '/uploads/' + fileName;
                    }
                }
                const { guild, channels, roles, categories } = await guildLists();
                const current = JSON.parse(JSON.stringify(this.client.settings));
                const { settings: next, errors } = velaMap_1.applyVelaState(current, S, { channels, roles, categories });
                if (errors.length) {
                    return res.status(400).json({ error: errors[0], errors });
                }
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(next, null, 4), 'utf8');
                const distSettingsPath = (0, path_2.join)(__dirname, '../settings.json');
                if ((0, fs_1.existsSync)(distSettingsPath) && distSettingsPath !== settingsPath) {
                    (0, fs_1.writeFileSync)(distSettingsPath, JSON.stringify(next, null, 4), 'utf8');
                }
                this.client.settings = next;
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error saving vela settings:', error);
                return res.status(500).json({ error: 'Failed to save settings' });
            }
        });
        this.app.get('/api/vela/applications', async (req, res) => {
            try {
                const { guild } = await guildLists();
                const status = req.query.status || 'pending';
                const list = await applicationModel_1.Application.find({ guildId: guild.id, status }).sort({ appliedAt: -1 }).limit(50).lean();
                for (const a of list) {
                    try {
                        const member = await guild.members.fetch(a.userId);
                        a.userTag = member.user.tag;
                    }
                    catch (e) {
                        a.userTag = null;
                    }
                }
                return res.json({ applications: list });
            }
            catch (error) {
                console.error('Error listing applications:', error);
                return res.status(500).json({ error: 'Failed to load applications' });
            }
        });
        this.app.post('/api/vela/applications/:id', async (req, res) => {
            try {
                const { guild } = await guildLists();
                const { status, note } = req.body || {};
                if (!['accepted', 'rejected', 'pending'].includes(status)) {
                    return res.status(400).json({ error: 'Invalid status' });
                }
                const app = await applicationModel_1.Application.findOne({ _id: req.params.id, guildId: guild.id });
                if (!app) {
                    return res.status(404).json({ error: 'Application not found' });
                }
                app.status = status;
                app.reviewNote = String(note || '');
                app.reviewedBy = req.session.user.id;
                app.reviewedAt = new Date();
                await app.save();
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error reviewing application:', error);
                return res.status(500).json({ error: 'Failed to save review' });
            }
        });
        this.app.post('/api/vela/tickets/post', async (req, res) => {
            try {
                const { guild, channels } = await guildLists();
                const raw = String((req.body && req.body.channelId) || '').trim();
                if (!raw) {
                    return res.status(400).json({ error: 'Select a panel channel first' });
                }
                let channel = guild.channels.cache.get(raw);
                if (!channel) {
                    const nm = raw.replace(/^#/, '').toLowerCase();
                    channel = guild.channels.cache.find((c) => typeof c.isTextBased === 'function' && c.isTextBased() && String(c.name || '').toLowerCase() === nm);
                }
                if (!channel || typeof channel.isTextBased !== 'function' || !channel.isTextBased()) {
                    return res.status(404).json({ error: 'Channel not found' });
                }
                const live = this.client.settings.ticket || {};
                if (!live.enabled) {
                    return res.status(400).json({ error: 'Enable tickets first (General card)' });
                }
                if (!Array.isArray(live.sections) || !live.sections.some((s) => s && s.enabled !== false)) {
                    return res.status(400).json({ error: 'Add at least one enabled ticket section first' });
                }
                const { TicketManager } = require('../src/ticket/ticketManager');
                const ticketManager = new TicketManager(this.client);
                await ticketManager.setupSystem(channel);
                const t = this.client.settings.ticket = this.client.settings.ticket || {};
                t.panel = t.panel || {};
                t.panel.channelId = channel.id;
                try {
                    const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                    const disk = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                    disk.ticket = disk.ticket || {};
                    disk.ticket.panel = disk.ticket.panel || {};
                    disk.ticket.panel.channelId = channel.id;
                    (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(disk, null, 4), 'utf8');
                    const distSettingsPath = (0, path_2.join)(__dirname, '../settings.json');
                    if ((0, fs_1.existsSync)(distSettingsPath) && distSettingsPath !== settingsPath) {
                        const disk2 = JSON.parse((0, fs_1.readFileSync)(distSettingsPath, 'utf8'));
                        disk2.ticket = disk2.ticket || {};
                        disk2.ticket.panel = disk2.ticket.panel || {};
                        disk2.ticket.panel.channelId = channel.id;
                        (0, fs_1.writeFileSync)(distSettingsPath, JSON.stringify(disk2, null, 4), 'utf8');
                    }
                }
                catch (e) {
                    console.error('Error persisting panel channel:', e.message || e);
                }
                return res.json({ success: true, channel: '#' + channel.name });
            }
            catch (error) {
                console.error('Error posting ticket panel:', error);
                return res.status(500).json({ error: error.message || 'Failed to post ticket panel' });
            }
        });
        this.app.get('/api/vela/ticket-stats', async (req, res) => {
            try {
                const { guild } = await guildLists();
                const [claimed, closed] = await Promise.all([
                    ticketModel_1.Ticket.aggregate([
                        { $match: { guildId: guild.id, claimedBy: { $ne: null } } },
                        { $group: { _id: '$claimedBy', received: { $sum: 1 } } }
                    ]),
                    ticketModel_1.Ticket.aggregate([
                        { $match: { guildId: guild.id, status: 'closed', closedBy: { $ne: null } } },
                        { $group: { _id: '$closedBy', finished: { $sum: 1 } } }
                    ])
                ]);
                const map = {};
                claimed.forEach((c) => { map[c._id] = map[c._id] || { userId: c._id, received: 0, finished: 0 }; map[c._id].received = c.received; });
                closed.forEach((c) => { map[c._id] = map[c._id] || { userId: c._id, received: 0, finished: 0 }; map[c._id].finished = c.finished; });
                const staff = Object.values(map).map((s) => ({ ...s, points: s.received + s.finished * 2 }));
                staff.sort((a, b) => b.points - a.points || b.finished - a.finished);
                for (const s of staff.slice(0, 25)) {
                    try {
                        const member = await guild.members.fetch(s.userId);
                        s.userTag = member.user.tag;
                    }
                    catch (e) {
                        s.userTag = null;
                    }
                }
                return res.json({ staff: staff.slice(0, 25), total: staff.length });
            }
            catch (error) {
                console.error('Error loading ticket stats:', error);
                return res.status(500).json({ error: 'Failed to load ticket stats' });
            }
        });
        this.app.get('/', async (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                const stats = await this.generateDashboardStats();
                const moduleStatus = this.getModuleStatus();
                const recentActivity = await this.getRecentActivity();
                const trends = {
                    servers: { percentage: 5, direction: 'up', period: 'week' },
                    users: { percentage: 12, direction: 'up', period: 'month' },
                    commands: { percentage: 8, direction: 'up', period: 'day' }
                };
                return res.render('index', {
                    title: locale.dashboard.title,
                    stats,
                    trends,
                    moduleStatus,
                    recentActivity,
                    settings: this.client.settings,
                    bot: this.client,
                    config: config_1.default,
                    path: '/',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/')
                });
            }
            catch (error) {
                console.error('Error rendering index page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale
                });
            }
        });
        this.app.get('/docs', (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                return res.render('docs', {
                    page: 'docs',
                    title: locale.docs.title || 'Documentation',
                    settings: this.client.settings,
                    bot: this.client,
                    config: config_1.default,
                    path: '/docs',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/docs')
                });
            }
            catch (error) {
                console.error('Error rendering documentation page:', error);
                return res.status(500).render('error', {
                    page: 'error',
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en'),
                    path: '/docs'
                });
            }
        });
        this.app.get('/settings', async (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                return res.render('settings', {
                    title: locale.dashboard.settings?.title || 'Bot Settings',
                    settings: this.client.settings,
                    bot: this.client,
                    config: config_1.default,
                    path: '/settings',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/settings')
                });
            }
            catch (error) {
                console.error('Error rendering settings page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale
                });
            }
        });
        this.app.get('/commands', (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            const categories = [
                {
                    id: 'general',
                    name: locale.dashboard.commands.general,
                    icon: 'users',
                    color: 'blue'
                },
                {
                    id: 'moderation',
                    name: locale.dashboard.commands.moderation,
                    icon: 'shield-alt',
                    color: 'purple'
                },
                {
                    id: 'utility',
                    name: locale.dashboard.commands.utility || 'Utility',
                    icon: 'tools',
                    color: 'green'
                }
            ];
            res.render('command-categories', {
                title: locale.dashboard.commands.title,
                categories,
                path: '/commands',
                currentLang,
                locale,
                breadcrumbs: this.getBreadcrumbs('/commands')
            });
        });
        this.app.get('/commands/general', (_req, res) => {
            const generalCommands = ['avatar', 'banner', 'ping', 'roles', 'server', 'user'].map(cmd => ({
                name: cmd,
                description: res.locals.locale.dashboard.commandDescriptions[cmd] || `${cmd} command`,
                enabled: this.client.settings.commands[cmd]?.enabled ?? false,
                aliases: this.client.settings.commands[cmd]?.aliases ?? [],
                cooldown: this.client.settings.commands[cmd]?.cooldown ?? 5
            }));
            res.render('commands', {
                title: res.locals.locale.dashboard.commands.general,
                page: 'general',
                commands: generalCommands,
                roles: this.client.guilds.cache.first()?.roles.cache.map(role => ({
                    id: role.id,
                    name: role.name
                })) ?? []
            });
        });
        this.app.get('/commands/moderation', (_req, res) => {
            const modCommands = ['ban', 'kick', 'mute', 'unmute', 'warn', 'unwarn', 'clear', 'lock', 'unlock', 'hide', 'unhide', 'move', 'timeout', 'rtimeout'].map(cmd => ({
                name: cmd,
                description: res.locals.locale.dashboard.commandDescriptions[cmd] || `${cmd} command`,
                enabled: this.client.settings.commands[cmd]?.enabled ?? false,
                aliases: this.client.settings.commands[cmd]?.aliases ?? [],
                cooldown: this.client.settings.commands[cmd]?.cooldown ?? 5
            }));
            res.render('commands', {
                title: res.locals.locale.dashboard.commands.moderation,
                page: 'moderation',
                commands: modCommands,
                roles: this.client.guilds.cache.first()?.roles.cache.map(role => ({
                    id: role.id,
                    name: role.name
                })) ?? []
            });
        });
        this.app.get('/commands/utility', (_req, res) => {
            const utilityCommands = ['setnick', 'role', 'rrole', 'warns', 'apply', 'ticket', 'unban'].map(cmd => ({
                name: cmd,
                description: res.locals.locale.dashboard.commandDescriptions[cmd] || `${cmd} command`,
                enabled: this.client.settings.commands[cmd]?.enabled ?? false,
                aliases: this.client.settings.commands[cmd]?.aliases ?? [],
                cooldown: this.client.settings.commands[cmd]?.cooldown ?? 5
            }));
            res.render('commands', {
                title: res.locals.locale.dashboard.commands.utility || 'Utility Commands',
                page: 'utility',
                commands: utilityCommands,
                roles: this.client.guilds.cache.first()?.roles.cache.map(role => ({
                    id: role.id,
                    name: role.name
                })) ?? []
            });
        });
        this.app.post('/api/commands/toggle', async (req, res) => {
            try {
                const { command, enabled } = req.body;
                console.log('Toggling command:', command, enabled);
                if (!command) {
                    return res.status(400).json({ error: 'Command name is required' });
                }
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                if (!currentSettings.commands[command]) {
                    currentSettings.commands[command] = {
                        enabled: enabled,
                        aliases: [],
                        cooldown: 5,
                        permissions: {
                            enabledRoleIds: [],
                            disabledRoleIds: []
                        }
                    };
                }
                else {
                    currentSettings.commands[command].enabled = enabled;
                }
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                this.client.settings = currentSettings;
                const verifySettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                console.log('Verified settings update:', {
                    command,
                    enabled: verifySettings.commands[command].enabled,
                    fileContent: verifySettings.commands[command]
                });
                return res.json({
                    success: true,
                    command,
                    enabled,
                    settings: verifySettings.commands[command]
                });
            }
            catch (error) {
                console.error('Error toggling command:', error);
                return res.status(500).json({ error: 'Failed to toggle command' });
            }
        });
        this.app.get('/api/commands/:command/permissions', (req, res) => {
            try {
                const command = req.params.command;
                if (!this.client.settings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }
                const permissions = this.client.settings.commands[command]?.permissions ?? {
                    enabledRoleIds: [],
                    disabledRoleIds: []
                };
                return res.json(permissions);
            }
            catch (error) {
                console.error('Error getting permissions:', error);
                return res.status(500).json({ error: 'Failed to get permissions' });
            }
        });
        this.app.post('/api/commands/:command/permissions', async (req, res) => {
            try {
                const { command } = req.params;
                const { enabledRoleIds, disabledRoleIds } = req.body;
                if (!this.client.settings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }
                this.client.settings.commands[command].permissions = {
                    enabledRoleIds,
                    disabledRoleIds
                };
                await this.saveSettings();
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error updating permissions:', error);
                return res.status(500).json({ error: 'Failed to update permissions' });
            }
        });
        this.app.post('/api/commands/:command/update', async (req, res) => {
            try {
                const { command } = req.params;
                const settings = req.body;
                if (!this.client.settings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }
                this.client.settings.commands[command] = {
                    ...this.client.settings.commands[command],
                    ...settings
                };
                await this.saveSettings();
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error updating command settings:', error);
                return res.status(500).json({ error: 'Failed to update command settings' });
            }
        });
        this.app.get('/api/roles', async (_req, res) => {
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }
                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.color,
                    position: role.position
                }));
                return res.json(roles);
            }
            catch (error) {
                console.error('Error fetching roles:', error);
                return res.status(500).json({ error: 'Failed to fetch roles' });
            }
        });
        this.app.get('/api/commands/:command/settings', async (req, res) => {
            try {
                const { command } = req.params;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                const currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                if (!currentSettings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }
                return res.json(currentSettings.commands[command]);
            }
            catch (error) {
                console.error('Error fetching command settings:', error);
                return res.status(500).json({ error: 'Failed to fetch command settings' });
            }
        });
        this.app.post('/api/commands/:command/settings', async (req, res) => {
            try {
                const { command } = req.params;
                const { aliases, permissions } = req.body;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                if (!currentSettings.commands[command]) {
                    return res.status(404).json({ error: 'Command not found' });
                }
                currentSettings.commands[command] = {
                    ...currentSettings.commands[command],
                    aliases: aliases || [],
                    permissions: {
                        enabledRoleIds: permissions?.enabledRoleIds || [],
                        disabledRoleIds: permissions?.disabledRoleIds || []
                    }
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.commands[command]
                });
            }
            catch (error) {
                console.error('Error saving command settings:', error);
                return res.status(500).json({ error: 'Failed to save command settings' });
            }
        });
        this.app.get('/api/channels', async (_req, res) => {
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).json({ error: 'Guild not found' });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === 0)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name,
                    type: channel.type
                }));
                return res.json(channels);
            }
            catch (error) {
                console.error('Error fetching channels:', error);
                return res.status(500).json({ error: 'Failed to fetch channels' });
            }
        });
        this.app.get('/logs', (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' },
                        currentLang,
                        locale,
                        path: '/logs'
                    });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === 0)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                return res.render('logs', {
                    title: locale.dashboard.logs.title,
                    settings: this.client.settings,
                    channels,
                    path: '/logs',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/logs')
                });
            }
            catch (error) {
                console.error('Error rendering logs page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/logs'
                });
            }
        });
        this.app.post('/api/logs/update', async (req, res) => {
            try {
                const { logType, settings } = req.body;
                if (!logType || !settings) {
                    return res.status(400).json({ error: 'Missing required parameters' });
                }
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                if (!currentSettings.logs[logType]) {
                    return res.status(404).json({ error: 'Log type not found' });
                }
                currentSettings.logs[logType] = {
                    ...currentSettings.logs[logType],
                    ...settings
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.logs[logType]
                });
            }
            catch (error) {
                console.error('Error updating log settings:', error);
                return res.status(500).json({ error: 'Failed to update log settings' });
            }
        });
        this.app.get('/protection', async (_req, res) => {
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' }
                    });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === 0)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor
                }));
                res.render('protection', {
                    title: res.locals.locale.dashboard.protection.title,
                    settings: this.client.settings,
                    channels: channels,
                    roles: roles,
                    path: '/protection'
                });
            }
            catch (error) {
                console.error('Error rendering protection page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });
        this.app.post('/api/protection/settings', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                currentSettings.protection = {
                    ...currentSettings.protection,
                    ...settings
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error saving protection settings:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save protection settings'
                });
            }
        });
        this.app.post('/api/protection/update', async (req, res) => {
            try {
                const { section, settings } = req.body;
                if (!section || !settings) {
                    return res.status(400).json({ error: 'Missing required parameters' });
                }
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                if (!currentSettings.protection) {
                    currentSettings.protection = {};
                }
                if (!currentSettings.protection[section]) {
                    currentSettings.protection[section] = {};
                }
                currentSettings.protection[section] = {
                    ...currentSettings.protection[section],
                    ...settings
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.protection[section]
                });
            }
            catch (error) {
                console.error('Error updating protection settings:', error);
                return res.status(500).json({ error: 'Failed to update protection settings' });
            }
        });
        this.app.get('/tickets', async (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' },
                        currentLang,
                        locale,
                        path: '/tickets'
                    });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === discord_js_1.ChannelType.GuildText)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const categories = guild.channels.cache
                    .filter(channel => channel.type === discord_js_1.ChannelType.GuildCategory)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor || '#ffffff'
                }));
                return res.render('tickets', {
                    title: locale.dashboard.tickets.title,
                    settings: this.client.settings,
                    channels,
                    categories,
                    roles,
                    path: '/tickets',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/tickets')
                });
            }
            catch (error) {
                console.error('Error rendering tickets page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/tickets'
                });
            }
        });
        this.app.post('/api/tickets/settings', async (req, res) => {
            try {
                const settings = req.body;
                if (settings.embed) {
                    if (settings.embed.thumbnail === '')
                        settings.embed.thumbnail = null;
                    if (settings.embed.footerIcon === '')
                        settings.embed.footerIcon = null;
                }
                if (settings.sections && Array.isArray(settings.sections)) {
                    settings.sections.forEach((section) => {
                        if (section.imageUrl === '')
                            section.imageUrl = null;
                    });
                }
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                currentSettings.ticket = {
                    ...currentSettings.ticket,
                    ...settings
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.ticket
                });
            }
            catch (error) {
                console.error('Error saving ticket settings:', error);
                return res.status(500).json({ error: 'Failed to save ticket settings' });
            }
        });
        this.app.get('/api/tickets/:section/settings', async (req, res) => {
            try {
                const { section } = req.params;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                const currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                if (!currentSettings.ticket.sections[section]) {
                    return res.status(404).json({ error: 'Section not found' });
                }
                return res.json(currentSettings.ticket.sections[section]);
            }
            catch (error) {
                console.error('Error fetching ticket section settings:', error);
                return res.status(500).json({ error: 'Failed to fetch section settings' });
            }
        });
        this.app.post('/api/tickets/:section/settings', async (req, res) => {
            try {
                const { section } = req.params;
                const settings = req.body;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                if (!currentSettings.ticket.sections[section]) {
                    return res.status(404).json({ error: 'Section not found' });
                }
                currentSettings.ticket.sections[section] = {
                    ...currentSettings.ticket.sections[section],
                    ...settings
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.ticket.sections[section]
                });
            }
            catch (error) {
                console.error('Error updating ticket section settings:', error);
                return res.status(500).json({ error: 'Failed to update section settings' });
            }
        });
        this.app.post('/api/tickets/sections/add', async (req, res) => {
            try {
                const newSection = req.body;
                if (newSection.imageUrl === '') {
                    newSection.imageUrl = null;
                }
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                currentSettings.ticket.sections.push(newSection);
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    section: newSection
                });
            }
            catch (error) {
                console.error('Error adding ticket section:', error);
                return res.status(500).json({ error: 'Failed to add ticket section' });
            }
        });
        this.app.delete('/api/tickets/sections/:index', async (req, res) => {
            try {
                const { index } = req.params;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                if (!currentSettings.ticket.sections[index]) {
                    return res.status(404).json({ error: 'Section not found' });
                }
                currentSettings.ticket.sections.splice(parseInt(index), 1);
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error deleting ticket section:', error);
                return res.status(500).json({ error: 'Failed to delete ticket section' });
            }
        });
        this.app.get('/apply', async (_req, res) => {
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' }
                    });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === discord_js_1.ChannelType.GuildText)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor,
                    position: role.position
                }));
                res.render('apply', {
                    title: res.locals.locale.dashboard.apply.title,
                    settings: this.client.settings,
                    channels,
                    roles,
                    path: '/apply'
                });
            }
            catch (error) {
                console.error('Error rendering apply page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });
        this.app.get('/api/apply/settings', async (_req, res) => {
            try {
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                const currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                return res.json(currentSettings.apply || {
                    enabled: false,
                    embed: {
                        color: "#3498db",
                        thumbnail: "",
                        footer: "",
                        footerIcon: "",
                        timestamp: true
                    },
                    positions: []
                });
            }
            catch (error) {
                console.error('Error fetching apply settings:', error);
                return res.status(500).json({ error: 'Failed to fetch apply settings' });
            }
        });
        this.app.post('/api/apply/settings', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                currentSettings.apply = {
                    ...currentSettings.apply,
                    ...settings
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.apply
                });
            }
            catch (error) {
                console.error('Error saving apply settings:', error);
                return res.status(500).json({ error: 'Failed to save apply settings' });
            }
        });
        this.app.delete('/api/apply/positions/:index', async (req, res) => {
            try {
                const { index } = req.params;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                if (!currentSettings.apply?.positions[index]) {
                    return res.status(404).json({ error: 'Position not found' });
                }
                currentSettings.apply.positions.splice(parseInt(index), 1);
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error deleting position:', error);
                return res.status(500).json({ error: 'Failed to delete position' });
            }
        });
        this.app.post('/api/apply/positions/add', async (req, res) => {
            try {
                const newPosition = req.body;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                if (!currentSettings.apply) {
                    currentSettings.apply = {
                        enabled: false,
                        embed: {
                            color: "#3498db",
                            thumbnail: "",
                            footer: "",
                            footerIcon: "",
                            timestamp: true
                        },
                        positions: []
                    };
                }
                currentSettings.apply.positions.push(newPosition);
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    position: newPosition
                });
            }
            catch (error) {
                console.error('Error adding position:', error);
                return res.status(500).json({ error: 'Failed to add position' });
            }
        });
        this.app.get('/rules', async (_req, res) => {
            try {
                res.render('rules', {
                    title: res.locals.locale.dashboard.rules.title,
                    settings: this.client.settings,
                    path: '/rules',
                    script: `<script>
                        window.settings = ${JSON.stringify(this.client.settings)};
                        console.log('Settings loaded:', window.settings);
                    </script>`
                });
            }
            catch (error) {
                console.error('Error rendering rules page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });
        this.app.post('/api/rules/settings', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                currentSettings.rules = {
                    ...currentSettings.rules,
                    ...settings
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.rules
                });
            }
            catch (error) {
                console.error('Error saving rules settings:', error);
                return res.status(500).json({ error: 'Failed to save rules settings' });
            }
        });
        this.app.get('/giveaway', async (_req, res) => {
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' }
                    });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === discord_js_1.ChannelType.GuildText)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor
                }));
                res.render('giveaway', {
                    title: res.locals.locale.dashboard.giveaway.title,
                    settings: this.client.settings,
                    channels,
                    roles,
                    path: '/giveaway'
                });
            }
            catch (error) {
                console.error('Error rendering giveaway page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });
        this.app.post('/api/giveaway/settings', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                currentSettings.giveaway = {
                    ...currentSettings.giveaway,
                    ...settings
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.giveaway
                });
            }
            catch (error) {
                console.error('Error saving giveaway settings:', error);
                return res.status(500).json({ error: 'Failed to save giveaway settings' });
            }
        });
        this.app.get('/tempchannels', async (_req, res) => {
            const currentLang = _req.cookies?.preferredLanguage || 'en';
            const locale = this.getLocale(currentLang);
            try {
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId);
                if (!guild) {
                    return res.status(404).render('error', {
                        title: '404 - Not Found',
                        error: { code: 404, message: 'Guild not found' },
                        currentLang,
                        locale,
                        path: '/tempchannels'
                    });
                }
                const channels = guild.channels.cache
                    .filter(channel => channel.type === discord_js_1.ChannelType.GuildVoice)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const categories = guild.channels.cache
                    .filter(channel => channel.type === discord_js_1.ChannelType.GuildCategory)
                    .map(channel => ({
                    id: channel.id,
                    name: channel.name
                }));
                const roles = guild.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(role => ({
                    id: role.id,
                    name: role.name,
                    color: role.hexColor || '#ffffff'
                }));
                return res.render('tempChannels', {
                    title: locale.dashboard.tempChannels.title,
                    settings: this.client.settings,
                    channels,
                    categories,
                    roles,
                    path: '/tempchannels',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/tempchannels')
                });
            }
            catch (error) {
                console.error('Error rendering temp channels page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang,
                    locale,
                    path: '/tempchannels'
                });
            }
        });
        this.app.post('/api/tempchannels/settings', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                currentSettings.tempChannels = {
                    ...currentSettings.tempChannels,
                    ...settings
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.tempChannels
                });
            }
            catch (error) {
                console.error('Error saving temp channels settings:', error);
                return res.status(500).json({ error: 'Failed to save temp channels settings' });
            }
        });
        this.app.get('/autoreply', async (_req, res) => {
            try {
                const settings = JSON.parse((0, fs_1.readFileSync)((0, path_2.join)(process.cwd(), 'settings.json'), 'utf8'));
                res.render('autoReply', {
                    title: res.locals.locale.dashboard.autoReply.title,
                    settings,
                    path: '/autoreply',
                    locale: res.locals.locale,
                    currentLang: res.locals.currentLang || 'en',
                    script: `<script>window.settings = ${JSON.stringify(settings)};</script>`
                });
            }
            catch (error) {
                console.error('Error loading auto reply page:', error);
                res.status(500).render('error', {
                    title: '500 - Server Error',
                    error: { code: 500, message: 'Internal server error' }
                });
            }
        });
        this.app.post('/api/autoreply/settings', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                currentSettings.autoReply = {
                    ...currentSettings.autoReply,
                    ...settings
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.autoReply
                });
            }
            catch (error) {
                console.error('Error saving auto reply settings:', error);
                return res.status(500).json({ error: 'Failed to save settings' });
            }
        });
        this.app.get('/suggestions', async (_req, res) => {
            try {
                const settings = JSON.parse((0, fs_1.readFileSync)((0, path_2.join)(process.cwd(), 'settings.json'), 'utf-8'));
                res.render('suggestions', {
                    title: res.locals.locale.dashboard.suggestions.title,
                    settings,
                    path: '/suggestions',
                    locale: res.locals.locale,
                    currentLang: res.locals.currentLang
                });
            }
            catch (error) {
                console.error('Error loading suggestions page:', error);
                res.status(500).send('Error loading page');
            }
        });
        this.app.post('/api/settings/suggestions', async (req, res) => {
            try {
                const settings = req.body;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                currentSettings.suggestions = {
                    ...currentSettings.suggestions,
                    ...settings
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.suggestions
                });
            }
            catch (error) {
                console.error('Error saving suggestions settings:', error);
                return res.status(500).json({ error: 'Failed to save settings' });
            }
        });
        this.app.get('/api/dashboard/stats', async (_req, res) => {
            try {
                const stats = await this.generateDashboardStats();
                return res.json({
                    success: true,
                    stats,
                    timestamp: new Date().toISOString()
                });
            }
            catch (error) {
                console.error('Error fetching dashboard stats:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch dashboard stats'
                });
            }
        });
        this.app.post('/api/settings/language', async (req, res) => {
            try {
                const { defaultLanguage, supportedLanguages } = req.body;
                if (!defaultLanguage || !supportedLanguages || !Array.isArray(supportedLanguages)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid input parameters'
                    });
                }
                if (supportedLanguages.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'At least one language must be supported'
                    });
                }
                if (!supportedLanguages.includes(defaultLanguage)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Default language must be included in supported languages'
                    });
                }
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                currentSettings.defaultLanguage = defaultLanguage;
                currentSettings.supportedLanguages = supportedLanguages;
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: {
                        defaultLanguage,
                        supportedLanguages
                    }
                });
            }
            catch (error) {
                console.error('Error updating language settings:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update language settings'
                });
            }
        });
        this.app.post('/api/settings/autoRoles', async (req, res) => {
            try {
                const settings = req.body;
                if (!settings || typeof settings.enabled !== 'boolean' ||
                    !settings.members || !settings.bots ||
                    typeof settings.members.enabled !== 'boolean' ||
                    typeof settings.bots.enabled !== 'boolean' ||
                    !Array.isArray(settings.members.roleIds) ||
                    !Array.isArray(settings.bots.roleIds)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid input parameters'
                    });
                }
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                currentSettings.autoRoles = {
                    enabled: settings.enabled,
                    members: {
                        enabled: settings.members.enabled,
                        roleIds: settings.members.roleIds
                    },
                    bots: {
                        enabled: settings.bots.enabled,
                        roleIds: settings.bots.roleIds
                    }
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    settings: currentSettings.autoRoles
                });
            }
            catch (error) {
                console.error('Error updating auto roles settings:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update auto roles settings'
                });
            }
        });
        this.app.get('/api/dashboard/chart/:period', async (req, res) => {
            try {
                const period = req.params.period;
                let days = 30;
                switch (period) {
                    case 'day':
                        days = 1;
                        break;
                    case 'week':
                        days = 7;
                        break;
                    case 'month':
                    default:
                        days = 30;
                        break;
                }
                const dates = Array.from({ length: days }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - (days - 1) + i);
                    return date.toISOString().split('T')[0];
                });
                const pingData = dates.map((_, i) => {
                    let baseValue = 80;
                    const dayVariation = Math.sin(i / 3) * 10;
                    const randomVariation = Math.floor(Math.random() * 30);
                    return Math.floor(baseValue + dayVariation + randomVariation);
                });
                const commandsData = dates.map((_, i) => {
                    const baseValue = 50;
                    const trendGrowth = i * 1.5;
                    const dayOfWeek = new Date(dates[i]).getDay();
                    const weekendBoost = (dayOfWeek === 0 || dayOfWeek === 6) ? 25 : 0;
                    const randomVariation = Math.floor(Math.random() * 15);
                    return Math.floor(baseValue + trendGrowth + weekendBoost + randomVariation);
                });
                const usersData = dates.map((_, i) => {
                    const baseValue = 300;
                    const trendGrowth = i * 5;
                    const dayOfWeek = new Date(dates[i]).getDay();
                    const weekendBoost = (dayOfWeek === 0 || dayOfWeek === 6) ? 100 : 0;
                    const randomVariation = Math.floor(Math.random() * 40);
                    return Math.floor(baseValue + trendGrowth + weekendBoost + randomVariation);
                });
                const formattedDates = dates.map(date => {
                    const d = new Date(date);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                });
                return res.json({
                    success: true,
                    data: {
                        labels: formattedDates,
                        datasets: {
                            ping: pingData,
                            commands: commandsData,
                            users: usersData
                        }
                    },
                    period,
                    timestamp: new Date().toISOString()
                });
            }
            catch (error) {
                console.error('Error generating chart data:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to generate chart data'
                });
            }
        });
        this.app.get('/welcome', async (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId) || this.client.guilds.cache.first();
                const channels = guild ? guild.channels.cache
                    .filter(channel => channel.isTextBased())
                    .map(channel => ({
                        id: channel.id,
                        name: channel.name
                    })) : [];
                return res.render('welcome', {
                    title: currentLang === 'ar' ? 'نظام الترحيب' : 'Welcome System',
                    channels,
                    settings: this.client.settings,
                    bot: this.client,
                    config: config_1.default,
                    path: '/welcome',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/welcome')
                });
            }
            catch (error) {
                console.error('Error rendering welcome system page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en'),
                    path: '/welcome'
                });
            }
        });
        this.app.post('/api/settings/welcome', async (req, res) => {
            try {
                const settings = req.body;
                if (!settings || typeof settings !== 'object') {
                    return res.status(400).json({ success: false, error: 'Invalid settings payload: empty or malformed JSON.' });
                }
                // Normalize: card-only system (legacy 'embed' -> 'card')
                if (settings.messageType === 'embed')
                    settings.messageType = 'card';
                if (settings.messageType && !['card', 'text'].includes(settings.messageType)) {
                    return res.status(400).json({ success: false, error: `Invalid messageType "${settings.messageType}". Allowed: card, text.` });
                }
                if (settings.enabled && !settings.channelId) {
                    return res.status(400).json({ success: false, error: 'Welcome is enabled but channelId is missing. Select a channel first.' });
                }
                const bg = typeof settings.card?.background === 'string' ? settings.card.background.trim() : '';
                if (bg && !(bg.startsWith('http://') || bg.startsWith('https://') || bg.startsWith('data:image/') || bg.startsWith('/uploads/'))) {
                    return res.status(400).json({ success: false, error: 'Background must be an http(s) image URL, an uploaded image (/uploads/...), a data URL, or empty.' });
                }
                // Drop legacy embed block if the old UI sent it
                if (settings.embed)
                    delete settings.embed;
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                let currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                currentSettings.welcome = {
                    ...currentSettings.welcome,
                    ...settings
                };
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                // Also write to dist/settings.json if it exists
                const distSettingsPath = (0, path_2.join)(__dirname, '../settings.json');
                if ((0, fs_1.existsSync)(distSettingsPath) && distSettingsPath !== settingsPath) {
                    (0, fs_1.writeFileSync)(distSettingsPath, JSON.stringify(currentSettings, null, 4), 'utf8');
                }
                this.client.settings = currentSettings;
                return res.json({
                    success: true,
                    message: 'Welcome settings saved and applied live.',
                    settings: currentSettings.welcome
                });
            }
            catch (error) {
                console.error('Error saving welcome settings:', error);
                return res.status(500).json({ success: false, error: 'Failed to write settings.json: ' + (error.message || 'unknown error') });
            }
        });
        this.app.post('/api/welcome/test', async (req, res) => {
            try {
                const welcomeConfig = req.body || {};
                if (welcomeConfig.messageType === 'embed')
                    welcomeConfig.messageType = 'card';
                if (!welcomeConfig.channelId) {
                    return res.status(400).json({ success: false, error: 'No channelId provided. Select a welcome channel first.' });
                }
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId) || this.client.guilds.cache.first();
                if (!guild) {
                    return res.status(404).json({ success: false, error: 'Bot is not in any guild. Invite it first.' });
                }
                await (0, welcomeManager_1.sendTestWelcome)(guild, this.client, welcomeConfig);
                return res.json({ success: true, message: 'Test card sent to the welcome channel.' });
            }
            catch (error) {
                console.error('Error sending test welcome:', error);
                return res.status(500).json({ success: false, error: error.message || 'Failed to send test welcome (check bot SendMessages + AttachFiles permission).' });
            }
        });
        this.app.post('/api/announce/send', async (req, res) => {
            try {
                const body = req.body || {};
                const applyVars = (text, map) => {
                    let out = String(text ?? '');
                    for (const [k, v] of Object.entries(map || {}))
                        out = out.split(`{${k}}`).join(String(v ?? ''));
                    return out;
                };
                if (!body.channelId) {
                    return res.status(400).json({ success: false, error: 'No channelId provided. Select an announcement channel first.' });
                }
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId) || this.client.guilds.cache.first();
                if (!guild) {
                    return res.status(404).json({ success: false, error: 'Bot is not in any guild. Invite it first.' });
                }
                let channel = guild.channels.cache.get(body.channelId);
                if (!channel && body.channelId) {
                    const nm = String(body.channelId).replace(/^#/, '').toLowerCase();
                    channel = guild.channels.cache.find((c) => typeof c.isTextBased === 'function' && c.isTextBased() && String(c.name || '').toLowerCase() === nm);
                }
                if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
                    return res.status(404).json({ success: false, error: 'Channel not found or not a text channel.' });
                }
                const voiceCount = guild.channels.cache
                    .filter((c) => c.type === discord_js_1.ChannelType.GuildVoice)
                    .reduce((n, c) => n + c.members.filter((m) => !m.user.bot).size, 0);
                const vars = { server: guild.name, count: guild.memberCount, voice: voiceCount };
                const mention = body.mention === 'Everyone' ? '@everyone ' : body.mention === 'Here' ? '@here ' : '';
                const vela = (this.client.settings && this.client.settings.vela) || {};
                let color = 0x5865f2;
                const m = /^#([0-9a-fA-F]{6})$/.exec(String(vela.emb || ''));
                if (m)
                    color = parseInt(m[1], 16);
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(String(applyVars(body.title || 'Announcement', vars)).slice(0, 256) || 'Announcement')
                    .setDescription(applyVars(body.message || '', vars).slice(0, 4000) || '…')
                    .setColor(color)
                    .setTimestamp();
                if (body.imageUrl)
                    embed.setImage(String(body.imageUrl));
                await channel.send({ content: mention || undefined, embeds: [embed] });
                return res.json({ success: true, message: 'Announcement sent.' });
            }
            catch (error) {
                console.error('Error sending announcement:', error);
                return res.status(500).json({ success: false, error: error.message || 'Failed to send announcement (check bot SendMessages permission).' });
            }
        });
        this.app.post('/api/verify/post', async (req, res) => {
            try {
                const body = req.body || {};
                if (!body.channelId) {
                    return res.status(400).json({ success: false, error: 'No channelId provided. Select a verification channel first.' });
                }
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId) || this.client.guilds.cache.first();
                if (!guild) {
                    return res.status(404).json({ success: false, error: 'Bot is not in any guild. Invite it first.' });
                }
                const channel = guild.channels.cache.get(body.channelId);
                if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
                    return res.status(404).json({ success: false, error: 'Channel not found or not a text channel.' });
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('Verification')
                    .setDescription('Press the button below to verify and unlock the server.')
                    .setColor(0x57f287)
                    .setTimestamp();
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('verify_btn').setLabel('Verify').setStyle(discord_js_1.ButtonStyle.Success).setEmoji('✅'));
                const useEmbed = body.useEmbed === undefined ? true : !!body.useEmbed;
                const text = String(body.message || 'Press the button below to verify and unlock the server.');
                const img = String(body.imageUrl || '').trim();
                let finalImg = (/^https?:\/\//i.test(img) ? img : '');
                if (useEmbed && body.noBg && finalImg) {
                    try {
                        const cutout = require('../src/welcome/cutout');
                        const axios = require('axios');
                        const dl = await axios({ url: finalImg, responseType: 'arraybuffer', timeout: 15000, maxContentLength: 4 * 1048576 });
                        const buf = Buffer.from(dl.data);
                        if (buf.length) {
                            const out = await cutout.cutoutBuffer(buf);
                            finalImg = 'data:image/png;base64,' + out.toString('base64');
                        }
                    }
                    catch (e) {
                        console.error('Verify image background removal failed, using original:', e.message || e);
                    }
                }
                if (useEmbed) {
                    embed.setTitle(String(body.title || 'Verification').slice(0, 256) || 'Verification');
                    embed.setDescription(text.slice(0, 4000));
                    if (finalImg)
                        embed.setImage(finalImg);
                    await channel.send({ embeds: [embed], components: [row] });
                }
                else {
                    await channel.send({ content: text.slice(0, 2000), components: [row] });
                }
                return res.json({ success: true, message: 'Verify message posted.' });
            }
            catch (error) {
                console.error('Error posting verify message:', error);
                return res.status(500).json({ success: false, error: error.message || 'Failed to post verify message (check bot SendMessages permission).' });
            }
        });
        this.app.get('/api/templates', async (req, res) => {
            try {
                const { listTemplates, hasBackup } = require('../src/utils/templates');
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId) || this.client.guilds.cache.first();
                const data = listTemplates();
                return res.json(Object.assign({}, data, { hasBackup: guild ? hasBackup(guild.id) : false }));
            }
            catch (error) {
                console.error('Error listing templates:', error);
                return res.status(500).json({ error: 'Failed to list templates.' });
            }
        });
        this.app.post('/api/templates/apply', async (req, res) => {
            try {
                const { listTemplates, applyTemplate } = require('../src/utils/templates');
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId) || this.client.guilds.cache.first();
                if (!guild) {
                    return res.status(404).json({ success: false, error: 'Bot is not in any guild. Invite it first.' });
                }
                const id = String((req.body && req.body.id) || '');
                const all = listTemplates().builtins.concat(listTemplates().customs);
                const tpl = all.find((t) => t.id === id);
                if (!tpl) {
                    return res.status(404).json({ success: false, error: 'Template not found.' });
                }
                const summary = await applyTemplate(guild, tpl);
                return res.json({ success: true, message: `Template applied: ${summary.roles} roles, ${summary.channels} channels created (${summary.skippedRoles + summary.skippedChannels} already existed). A backup was saved first.` });
            }
            catch (error) {
                console.error('Error applying template:', error);
                return res.status(500).json({ success: false, error: error.message || 'Failed to apply template (check bot Manage Channels + Manage Roles).' });
            }
        });
        this.app.post('/api/templates/save-current', async (req, res) => {
            try {
                const { saveCurrentAsTemplate } = require('../src/utils/templates');
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId) || this.client.guilds.cache.first();
                if (!guild) {
                    return res.status(404).json({ success: false, error: 'Bot is not in any guild. Invite it first.' });
                }
                const r = await saveCurrentAsTemplate(guild, req.body && req.body.name);
                if (r.error) {
                    return res.status(400).json({ success: false, error: r.error });
                }
                return res.json({ success: true, message: 'Current structure saved as a template.' });
            }
            catch (error) {
                console.error('Error saving template:', error);
                return res.status(500).json({ success: false, error: 'Failed to save template.' });
            }
        });
        this.app.post('/api/templates/restore', async (req, res) => {
            try {
                const { restoreBackup } = require('../src/utils/templates');
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId) || this.client.guilds.cache.first();
                if (!guild) {
                    return res.status(404).json({ success: false, error: 'Bot is not in any guild. Invite it first.' });
                }
                const r = await restoreBackup(guild);
                if (r.error) {
                    return res.status(400).json({ success: false, error: r.error });
                }
                return res.json({ success: true, message: `Backup restored: ${r.summary.roles} roles, ${r.summary.channels} channels recreated.` });
            }
            catch (error) {
                console.error('Error restoring backup:', error);
                return res.status(500).json({ success: false, error: 'Failed to restore backup.' });
            }
        });
        this.app.delete('/api/templates/custom/:id', async (req, res) => {
            try {
                const { deleteCustomTemplate } = require('../src/utils/templates');
                const r = await deleteCustomTemplate(String(req.params.id));
                if (r.error) {
                    return res.status(400).json({ success: false, error: r.error });
                }
                return res.json({ success: true });
            }
            catch (error) {
                console.error('Error deleting template:', error);
                return res.status(500).json({ success: false, error: 'Failed to delete template.' });
            }
        });
        this.app.post('/api/welcome/diagnose', async (req, res) => {
            const checks = [];
            const push = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: String(detail || '') });
            try {
                const cfg = req.body || {};
                if (cfg.messageType === 'embed')
                    cfg.messageType = 'card';
                const guild = this.client.guilds.cache.get(config_1.default.mainGuildId) || this.client.guilds.cache.first();
                if (!guild) {
                    push('guild', false, 'Bot is not in any guild. Invite it first.');
                    return res.json({ ok: false, checks });
                }
                push('guild', true, guild.name + ' (' + guild.id + ')');
                let me = guild.members.me;
                try {
                    me = await guild.members.fetchMe();
                }
                catch (e) { /* fall back to cache */ }
                if (!me) {
                    push('bot-member', false, 'Bot member object not cached. Restart the bot.');
                }
                else {
                    push('bot-member', true, me.user.tag);
                }
                const channelId = cfg.channelId;
                let channel = null;
                if (!channelId) {
                    push('channel', false, 'No channel selected in the dashboard.');
                }
                else {
                    channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
                    if (!channel || !channel.isTextBased()) {
                        push('channel', false, 'Channel ' + channelId + ' not found or not a text channel.');
                    }
                    else {
                        push('channel', true, '#' + channel.name);
                        if (me) {
                            const perms = channel.permissionsFor(me);
                            const need = ['ViewChannel', 'SendMessages', 'AttachFiles'];
                            need.forEach((p) => {
                                const has = perms ? perms.has(p) : false;
                                let detail = has ? 'granted in #' + channel.name : 'MISSING in #' + channel.name;
                                if (!has) {
                                    try {
                                        const roleNames = me.roles.cache.map((r) => r.name).join(', ');
                                        const ows = channel.permissionOverwrites.cache.map((o) => {
                                            const name = o.type === 0 ? ('role:' + (guild.roles.cache.get(o.id)?.name || o.id)) : ('member:' + o.id);
                                            return name + ' [allow:' + o.allow.toArray().join('+') + ' deny:' + o.deny.toArray().join('+') + ']';
                                        }).join(' | ');
                                        detail += ' || bot roles: ' + roleNames + ' || overwrites: ' + ows;
                                    }
                                    catch (e) { /* ignore */ }
                                }
                                push('perm:' + p, has, detail);
                            });
                        }
                    }
                }
                try {
                    const gen = require('../src/welcome/welcomeCardGenerator');
                    const fakeMember = { id: this.client.user.id, user: this.client.user, displayName: this.client.user.username, guild };
                    const t0 = Date.now();
                    const buf = await gen.generateWelcomeCard(fakeMember, cfg.card || {});
                    push('card-render', !!(buf && buf.length > 500), 'PNG bytes=' + (buf ? buf.length : 0) + ' in ' + (Date.now() - t0) + 'ms');
                }
                catch (e) {
                    push('card-render', false, 'Generator threw: ' + (e.message || e));
                }
                const bg = (((cfg.card || {}).background) || '').trim();
                if (!bg) {
                    push('background', true, 'empty — default gradient will be used');
                }
                else if (/^data:image\//i.test(bg)) {
                    push('background', true, 'embedded upload (' + Math.round(bg.length / 1024) + 'KB). Tip: re-upload to store as /uploads file.');
                }
                else if (/^https?:\/\//i.test(bg)) {
                    try {
                        const ctrl = new AbortController();
                        const to = setTimeout(() => ctrl.abort(), 8000);
                        const r = await fetch(bg, { method: 'HEAD', signal: ctrl.signal });
                        clearTimeout(to);
                        push('background', r.ok, 'URL HEAD -> HTTP ' + r.status + (r.ok ? '' : ' — image may not load; upload the file instead'));
                    }
                    catch (e) {
                        push('background', false, 'URL unreachable (' + (e.message || 'fetch failed') + ') — upload the file instead');
                    }
                }
                else if (bg.startsWith('/')) {
                    const abs = (0, path_2.join)(__dirname, 'public', bg.replace(/^\/+/, ''));
                    push('background', (0, fs_1.existsSync)(abs), (0, fs_1.existsSync)(abs) ? 'file exists: ' + bg : 'FILE MISSING on disk: ' + bg + ' — re-upload the image and Save');
                }
                else {
                    push('background', false, 'Unknown format. Use http(s) URL, /uploads file, or empty.');
                }
                const ok = checks.every((c) => c.ok);
                return res.json({ ok, checks });
            }
            catch (error) {
                console.error('Error diagnosing welcome:', error);
                push('diagnose', false, error.message || 'diagnose crashed');
                return res.status(500).json({ ok: false, checks });
            }
        });
        this.app.post('/api/welcome/client-error', async (req, res) => {
            try {
                const { message, stack, url, ua } = req.body || {};
                console.error('[welcome:browser] ' + (message || 'unknown') + ' | url=' + (url || '?') + ' | ua=' + (ua || '?'));
                if (stack)
                    console.error('[welcome:browser:stack] ' + String(stack).slice(0, 1500));
                return res.json({ success: true });
            }
            catch (error) {
                return res.status(500).json({ success: false });
            }
        });
        this.app.post('/api/welcome/upload-bg', async (req, res) => {
            try {
                const { image } = req.body;
                if (!image || !image.startsWith('data:image/')) {
                    return res.status(400).json({ error: 'Invalid image data' });
                }
                const uploadsDir = (0, path_2.join)(__dirname, 'public', 'uploads');
                if (!(0, fs_1.existsSync)(uploadsDir)) {
                    (0, fs_1.mkdirSync)(uploadsDir, { recursive: true });
                }
                const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
                const fileName = `welcome-bg-${Date.now()}.png`;
                const filePath = (0, path_2.join)(uploadsDir, fileName);
                (0, fs_1.writeFileSync)(filePath, Buffer.from(base64Data, 'base64'));
                const fileUrl = `/uploads/${fileName}`;
                return res.json({ success: true, url: fileUrl });
            }
            catch (error) {
                console.error('Error uploading background image:', error);
                return res.status(500).json({ error: 'Failed to upload image' });
            }
        });
        this.app.get('/selectroles', (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.selectRoles.title,
                    feature: 'selectRoles',
                    featureIcon: 'fas fa-id-badge',
                    settings: this.client.settings,
                    bot: this.client,
                    config: config_1.default,
                    path: '/selectroles',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/selectroles')
                });
            }
            catch (error) {
                console.error('Error rendering select roles page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });
        this.app.get('/games', (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.games.title,
                    feature: 'games',
                    featureIcon: 'fas fa-gamepad',
                    settings: this.client.settings,
                    bot: this.client,
                    config: config_1.default,
                    path: '/games',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/games')
                });
            }
            catch (error) {
                console.error('Error rendering games page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });
        this.app.get('/automod', (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.autoMod.title,
                    feature: 'autoMod',
                    featureIcon: 'fas fa-robot',
                    settings: this.client.settings,
                    bot: this.client,
                    config: config_1.default,
                    path: '/automod',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/automod')
                });
            }
            catch (error) {
                console.error('Error rendering automod page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });
        this.app.get('/autolines', (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.autoLines.title,
                    feature: 'autoLines',
                    featureIcon: 'fas fa-align-left',
                    settings: this.client.settings,
                    bot: this.client,
                    config: config_1.default,
                    path: '/autolines',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/autolines')
                });
            }
            catch (error) {
                console.error('Error rendering auto lines page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });
        this.app.get('/leveling', (_req, res) => {
            try {
                const currentLang = _req.cookies?.preferredLanguage || 'en';
                const locale = this.getLocale(currentLang);
                return res.render('coming-soon', {
                    title: locale.comingSoon.features.leveling.title,
                    feature: 'leveling',
                    featureIcon: 'fas fa-chart-line',
                    settings: this.client.settings,
                    bot: this.client,
                    config: config_1.default,
                    path: '/leveling',
                    currentLang,
                    locale,
                    breadcrumbs: this.getBreadcrumbs('/leveling')
                });
            }
            catch (error) {
                console.error('Error rendering leveling system page:', error);
                return res.status(500).render('error', {
                    title: 'Error',
                    error: { code: 500, message: 'Internal Server Error' },
                    currentLang: 'en',
                    locale: this.getLocale('en')
                });
            }
        });
        this.app.get('/api/commands/list', async (_req, res) => {
            try {
                const settingsPath = (0, path_2.join)(process.cwd(), 'settings.json');
                const currentSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
                const allCommands = Object.entries(currentSettings.commands).map(([name, data]) => {
                    const commandData = data;
                    return {
                        name,
                        enabled: commandData.enabled || false,
                        aliases: commandData.aliases || [],
                        cooldown: commandData.cooldown || 5,
                        permissions: commandData.permissions || { enabledRoleIds: [], disabledRoleIds: [] }
                    };
                });
                const generalCommands = ['avatar', 'banner', 'ping', 'roles', 'server', 'user'];
                const moderationCommands = ['ban', 'kick', 'mute', 'unmute', 'warn', 'unwarn', 'clear', 'lock', 'unlock', 'hide', 'unhide', 'move', 'timeout', 'rtimeout'];
                const categories = {
                    general: allCommands.filter(cmd => generalCommands.includes(cmd.name)),
                    moderation: allCommands.filter(cmd => moderationCommands.includes(cmd.name)),
                    utility: allCommands.filter(cmd => !generalCommands.includes(cmd.name) && !moderationCommands.includes(cmd.name))
                };
                return res.json({
                    success: true,
                    categories,
                    allCommands
                });
            }
            catch (error) {
                console.error('Error fetching commands list:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch commands list'
                });
            }
        });
        this.app.use((_req, res) => {
            const locale = res.locals?.locale || this.getLocale('en');
            const notFound = locale?.dashboard?.error?.['404'] || { title: 'Not Found', message: 'The page you requested could not be found.' };
            res.status(404).render('error', {
                title: '404 - ' + notFound.title,
                error: {
                    code: 404,
                    message: notFound.message
                }
            });
        });
    }
    async saveSettings(settings) {
        try {
            const settingsPath = (0, path_2.join)(__dirname, '../settings.json');
            const settingsToSave = settings || this.client.settings;
            const settingsString = JSON.stringify(settingsToSave, null, 4);
            await (0, fs_1.writeFileSync)(settingsPath, settingsString);
            console.log('Settings saved successfully');
            delete require.cache[require.resolve('../settings.json')];
            const savedSettings = JSON.parse((0, fs_1.readFileSync)(settingsPath, 'utf8'));
            console.log('Verified saved settings:', savedSettings.commands[Object.keys(savedSettings.commands)[0]]);
            if (settings) {
                this.client.settings = settings;
            }
        }
        catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }
    start() {
        try {
            this.app.listen(config_1.default.dashboard.port, () => {
                console.log(`Dashboard running at http://localhost:${config_1.default.dashboard.port}`);
            });
        }
        catch (error) {
            console.error('Failed to start dashboard:', error);
        }
    }
    async generateDashboardStats() {
        const serverCount = this.client.guilds.cache.size;
        const memberCount = this.client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
        const commandCount = this.client.commands.size;
        const totalChannels = this.client.guilds.cache.reduce((acc, guild) => acc + guild.channels.cache.size, 0);
        const memoryUsage = process.memoryUsage();
        const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
        let commandsUsed = 0;
        const commandStats = this.client.commandStats;
        if (commandStats && typeof commandStats === 'object') {
            commandsUsed = Object.values(commandStats).reduce((sum, count) => sum + count, 0);
        }
        const protection = this.client.settings.protection || {};
        const activeProtections = Object.keys(protection)
            .filter(k => k !== 'enabled' && protection[k]?.enabled)
            .length;
        const protectedRoles = protection.protectedRoles?.roles?.length || 0;
        const whitelistedBots = protection.antibot?.whitelistedBots?.length || 0;
        const logs = this.client.settings.logs || {};
        const logsArray = Object.values(logs);
        const activeLogs = logsArray.filter(log => log.enabled).length;
        const uptimeSeconds = process.uptime();
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptime = days > 0
            ? `${days}d ${hours}h ${minutes}m`
            : hours > 0
                ? `${hours}h ${minutes}m`
                : `${minutes}m`;
        return {
            servers: serverCount,
            users: memberCount,
            commands: commandCount,
            commandsUsed,
            channels: totalChannels,
            ping: this.getPing(),
            uptime,
            memoryUsage: memoryUsageMB,
            protection: {
                activeProtections,
                protectedRoles,
                whitelistedBots,
                activeLogs
            }
        };
    }
    getModuleStatus() {
        const settings = this.client.settings;
        return {
            protection: {
                enabled: settings.protection?.enabled || false,
                activeRules: Object.keys(settings.protection || {})
                    .filter(k => k !== 'enabled' && settings.protection[k]?.enabled)
                    .length
            },
            tickets: {
                enabled: settings.ticket?.enabled || false,
                sections: (settings.ticket?.sections || []).length
            },
            apply: {
                enabled: settings.apply?.enabled || false,
                positions: (settings.apply?.positions || [])
                    .filter((p) => p.enabled)
                    .length
            },
            rules: {
                enabled: settings.rules?.enabled || false,
                sections: (settings.rules?.sections || []).length
            },
            giveaway: {
                enabled: settings.giveaway?.enabled || false
            },
            logs: {
                enabled: Object.values(settings.logs || {}).some((log) => log.enabled),
                activeTypes: Object.values(settings.logs || {}).filter((log) => log.enabled).length
            },
            autoReply: {
                enabled: settings.autoReply?.enabled || false,
                triggers: (settings.autoReply?.triggers || []).length
            },
            tempChannels: {
                enabled: settings.tempChannels?.enabled || false
            },
            suggestions: {
                enabled: settings.suggestions?.enabled || false
            }
        };
    }
    async getRecentActivity() {
        const now = new Date();
        return [
            {
                id: 'system-init',
                type: 'system',
                title: 'System Initialized',
                description: 'All systems are up and running',
                icon: 'check-circle',
                color: 'blue',
                timestamp: this.startTime,
                timeAgo: this.getRelativeTime(this.startTime)
            },
            {
                id: 'api-connected',
                type: 'connection',
                title: 'API Connected',
                description: 'Gateway connection established',
                icon: 'server',
                color: 'green',
                timestamp: new Date(now.getTime() - 10 * 60000),
                timeAgo: '10 minutes ago'
            },
            {
                id: 'protection-active',
                type: 'protection',
                title: 'Protection Active',
                description: 'Server security systems enabled',
                icon: 'shield-alt',
                color: 'purple',
                timestamp: new Date(now.getTime() - 30 * 60000),
                timeAgo: '30 minutes ago'
            },
            {
                id: 'settings-updated',
                type: 'settings',
                title: 'Settings Updated',
                description: 'Configuration changes applied',
                icon: 'sync',
                color: 'amber',
                timestamp: new Date(now.getTime() - 60 * 60000),
                timeAgo: '1 hour ago'
            }
        ];
    }
    getRelativeTime(date) {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.round(diffMs / 1000);
        const diffMin = Math.round(diffSec / 60);
        const diffHour = Math.round(diffMin / 60);
        const diffDay = Math.round(diffHour / 24);
        if (diffSec < 60)
            return 'Just now';
        if (diffMin < 60)
            return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
        if (diffHour < 24)
            return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
        return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    }
}
exports.Dashboard = Dashboard;
