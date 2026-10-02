"use strict";
// Mapping between Vela dashboard state keys and the bot's settings.json schema.
// Card canvas is 800x350: x_px = Nx% * 8, y_px = Ny% * 3.5, font/size_px = Ns% * 8.
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyVelaState = exports.stateFromSettings = exports.COMMANDS = void 0;

const COMMANDS = [
    ["apply", "Manage the application system"],
    ["ban", "Bans a member from the server"],
    ["clear", "Clears messages from the channel"],
    ["giveaway", "Create a new giveaway"],
    ["hide", "Hides a channel"],
    ["kick", "Kicks a member from the server"],
    ["lock", "Locks a channel"],
    ["move", "Moves a member to your voice channel"],
    ["mute", "Mutes a member"],
    ["protection", "All protections in one smart command"],
    ["prison", "Sends a member to prison"],
    ["unprison", "Releases a member from prison"],
    ["punish", "Shows punishments on a member"],
    ["blacklist", "Server blacklist: ban and re-ban"],
    ["blockimg", "Blocks a member from sending images"],
    ["unblockimg", "Allows a member to send images"],
    ["noimages", "Disables images in channels"],
    ["images", "Enables images in channels"],
    ["role", "Gives or removes a role from a user"],
    ["rrole", "Removes a role from a user"],
    ["rtimeout", "Removes timeout from a member"],
    ["rules", "Manage the rules system"],
    ["setnick", "Changes a member's nickname"],
    ["ticket", "Manage the ticket system"],
    ["timeout", "Timeouts a member"],
    ["unban", "Unbans a user by ID"],
    ["unhide", "Unhides a channel"],
    ["unlock", "Unlocks a channel"],
    ["unmute", "Unmutes a member"],
    ["unwarn", "Removes a warning from a member"],
    ["warn", "Warns a member"],
    ["warns", "Shows warnings for a member"],
    ["rooms", "Shows voice rooms occupancy"],
    ["topvoice", "Top members by voice time"],
    ["toptext", "Top members by messages"],
    ["topgroups", "Top roles by members"],
    ["cgroup", "Create a private group"],
    ["dgroup", "Delete a private group"],
    ["grole", "Add a member to a group"],
    ["groups", "List private groups"],
    ["ogroup", "Transfer group ownership"],
    ["panel", "Post the groups join panel"],
    ["removemember", "Remove a member from a group"],
    ["avatar", "Shows user avatar"],
    ["banner", "Shows user or server banner"],
    ["ping", "Shows bot latency information"],
    ["roles", "Shows server roles information"],
    ["server", "Shows server information"],
    ["user", "Shows user information"],
    ["verify", "Verify yourself and get the member role"]
];
exports.COMMANDS = COMMANDS;

// Every log event in settings.logs (keep in sync with LOG_TYPES in views/vela.ejs).
const LOG_TYPES = [
    'memberBan', 'memberUnban', 'memberKick', 'memberTimeout', 'memberUntimeout',
    'messageDelete', 'messageEdit', 'messageBulkDelete', 'messageImage', 'messageImageDelete',
    'memberJoin', 'memberLeave', 'nicknameUpdate',
    'roleCreate', 'roleDelete', 'roleUpdate', 'roleGive', 'roleRemove',
    'channelCreate', 'channelDelete', 'channelUpdate',
    'threadCreate', 'threadDelete', 'threadUpdate',
    'voiceJoin', 'voiceLeave', 'voiceMove', 'voiceServerMute', 'voiceServerDeafen',
    'serverUpdate',
    'emojiCreate', 'emojiDelete', 'emojiUpdate',
    'stickerCreate', 'stickerDelete', 'stickerUpdate',
    'inviteCreate'
];

function num(v, d) {
    const n = parseFloat(v);
    return isNaN(n) ? d : n;
}
function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}
function resolveChannel(v, channels) {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    if (!s) return null;
    let c = channels.find((x) => x.id === s);
    if (c) return c.id;
    const name = s.replace(/^#/, '').toLowerCase();
    c = channels.find((x) => String(x.name || '').toLowerCase() === name);
    return c ? c.id : null;
}
function resolveRole(v, roles) {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    if (!s) return null;
    let r = roles.find((x) => x.id === s);
    if (r) return r.id;
    const name = s.replace(/^@/, '').toLowerCase();
    r = roles.find((x) => String(x.name || '').toLowerCase() === name);
    return r ? r.id : s;
}
function channelName(id, channels) {
    const c = channels.find((x) => x.id === id);
    return c ? '#' + c.name : '';
}
function layoutToPx(S, p) {
    // Vela % layout -> card px (avatar uses As for size, name uses Ns)
    return {
        nx: Math.round(num(S[p + 'Nx'], 50) / 100 * 800),
        ny: Math.round(num(S[p + 'Ny'], 78) / 100 * 350),
        ns: Math.round(num(S[p + 'Ns'], 7) / 100 * 800),
        ax: Math.round(num(S[p + 'Ax'], 50) / 100 * 800),
        ay: Math.round(num(S[p + 'Ay'], 36) / 100 * 350),
        as: Math.round(num(S[p + 'As'], 20) / 100 * 800)
    };
}
function pxToLayout(card) {
    const u = (card && card.username) || {};
    const a = (card && card.avatar) || {};
    return {
        Nx: Math.round((((u.x ?? 400) / 800) * 100) * 10) / 10,
        Ny: Math.round((((u.y ?? 260) / 350) * 100) * 10) / 10,
        Ns: Math.round((((u.fontSize ?? 34) / 800) * 100) * 10) / 10,
        Ax: Math.round((((a.x ?? 400) / 800) * 100) * 10) / 10,
        Ay: Math.round((((a.y ?? 110) / 350) * 100) * 10) / 10,
        As: Math.round((((a.size ?? 120) / 800) * 100) * 10) / 10
    };
}

// Fields with a REAL backend counterpart. Everything else goes to settings.vela verbatim.
const EXTRA_KEYS = new Set([
    'emb', 'mgr', 'arDelay', 'wBgMode', 'wBgColor',
    'tkCh', 'tkCat', 'tkRole', 'tkLog', 'tkMax',
    'mDm', 'mReason', 'mLog', 'wThr', 'wAct', 'toDur',
    'amLink', 'amInv', 'amCaps', 'amMen', 'amWords', 'amAct', 'amEx',
    'scRaid', 'scJoin', 'scNew', 'scAge',
    'rrOn', 'rrCh', 'rrMode', 'vOn', 'vMode', 'vCh', 'vRole', 'vDenyRole',
    'vEmbOn', 'vMsg', 'vEmbImg', 'vEmbNoBg',
    'lvOn', 'lvXp', 'lvCd', 'lvCh', 'lvMsg',
    'ccOn', 'ccPre', 'ccName', 'ccRes',
    'rsTr', 'rsRes', 'anCh', 'anMsg', 'anImg', 'anMention', 'anTitle',
    'rmMention', 'rmTitle',
    'prisonRole',
    'imgRole', 'imgBlockedChannels', 'imgFilterOn',
    'blReban',
    'sysJoinMinAge', 'sysJoinAllowedAge', 'sysJoinReason',
    // System protection keys (from system/ folder)
    'sysAntiCreate', 'sysAntiDelete', 'sysAntiPerms', 'sysAntiWebhook',
    'sysAntiBots', 'sysAntiSpam', 'sysAntiLink', 'sysAntiJoin',
    'sysPunishBan', 'sysPunishKick', 'sysPunishChanDel', 'sysPunishRoleDel',
    'sysPunishChanCreate', 'sysPunishWebhook', 'sysPunishBotAdd',
    'sysTimeoutMin', 'sysBypassRole1', 'sysBypassRole2', 'sysBypassRole3',
    'sysWordFilter', 'sysWordList'
]);

function applyVelaState(settings, S, ctx) {
    const errors = [];
    const channels = (ctx && ctx.channels) || [];
    const roles = (ctx && ctx.roles) || [];
    const needChan = (label, v) => {
        if (v === undefined || v === null || String(v).trim() === '') return undefined;
        const id = resolveChannel(v, channels);
        if (!id) errors.push(label + ': channel not found: ' + v);
        return id;
    };

    if (S.lang !== undefined) settings.defaultLanguage = (S.lang === 'العربية' ? 'ar' : 'en');

    settings.commands = settings.commands || {};
    const cleanCmdRoles = (v) => {
        if (!Array.isArray(v)) return undefined;
        const out = [];
        v.forEach((r) => {
            const s = String(r || '').trim();
            if (!s) return;
            const id = resolveRole(s, roles);
            if (roles.some((x) => String(x.id) === String(id)) && !out.includes(String(id))) out.push(String(id));
        });
        return out;
    };
    const cleanCmdChannels = (v) => {
        if (!Array.isArray(v)) return undefined;
        const out = [];
        v.forEach((c) => {
            const s = String(c || '').trim();
            if (!s) return;
            const id = resolveChannel(s, channels);
            if (id && !out.includes(id)) out.push(id);
        });
        return out;
    };
    COMMANDS.forEach(([name]) => {
        const cmd = settings.commands[name] = settings.commands[name] || { enabled: true, aliases: [], cooldown: 5, permissions: { enabledRoleIds: [], disabledRoleIds: [] } };
        cmd.permissions = cmd.permissions || { enabledRoleIds: [], disabledRoleIds: [] };
        cmd.channels = cmd.channels || { enabledChannelIds: [], disabledChannelIds: [] };
        if (S['c_' + name] !== undefined) cmd.enabled = !!S['c_' + name];
        if (S['cooldown_' + name] !== undefined) cmd.cooldown = Math.max(0, Math.round(num(S['cooldown_' + name], 5)));
        if (S['aliases_' + name] !== undefined) {
            cmd.aliases = String(S['aliases_' + name]).split(',').map((a) => a.trim().toLowerCase().replace(/^[/!]+/, '')).filter((a, i, arr) => a && arr.indexOf(a) === i);
        }
        const allow = cleanCmdRoles(S['allowroles_' + name]);
        if (allow !== undefined) cmd.permissions.enabledRoleIds = allow;
        const deny = cleanCmdRoles(S['denyroles_' + name]);
        if (deny !== undefined) cmd.permissions.disabledRoleIds = deny;
        const allowCh = cleanCmdChannels(S['allowchats_' + name]);
        if (allowCh !== undefined) cmd.channels.enabledChannelIds = allowCh;
        const denyCh = cleanCmdChannels(S['denychats_' + name]);
        if (denyCh !== undefined) cmd.channels.disabledChannelIds = denyCh;
    });

    // ---- Welcome (full backend) ----
    const w = settings.welcome = settings.welcome || {};
    w.enabled = !!(S.wOn || S.gOn);
    w.textEnabled = S.wOn === undefined ? true : !!S.wOn;
    if (S.wMsg !== undefined) { w.message = String(S.wMsg); w.textMessage = String(S.wMsg); }
    w.textDestination = 'channel';
    const wChId = needChan('Welcome channel', S.wCh);
    if (wChId) { w.channelId = wChId; w.imageChannelId = wChId; }
    w.messageType = 'card';
    w.imageMode = 'with';
    w.dm = w.dm || {};
    if (S.wDm !== undefined) w.dm.enabled = !!S.wDm;
    if (S.wMsg !== undefined) w.dm.message = String(S.wMsg);
    const card = w.card = w.card || {};
    card.enabled = true;
    if (S.wImg !== undefined) card.background = String(S.wImg);
    if (S.wBgMode !== undefined) card.backgroundMode = (S.wBgMode === 'Solid' ? 'solid' : S.wBgMode === 'Custom image' ? 'custom' : 'transparent');
    if (S.wBgColor !== undefined) card.backgroundColor = String(S.wBgColor || '#14171c');
    const wl = layoutToPx(S, 'w');
    const wu = card.username = card.username || {};
    wu.text = '{username}';
    wu.x = clamp(wl.nx, 0, 800); wu.y = clamp(wl.ny, 0, 350); wu.fontSize = clamp(wl.ns, 8, 120);
    wu.color = wu.color || '#ffffff'; wu.align = 'center';
    if (S.wShowN !== undefined) wu.show = !!S.wShowN;
    const wav = card.avatar = card.avatar || {};
    wav.x = clamp(wl.ax, 0, 800); wav.y = clamp(wl.ay, 0, 350); wav.size = clamp(wl.as, 20, 400);
    wav.shape = wav.shape || 'circle';
    if (wav.borderWidth === undefined) wav.borderWidth = 4;
    wav.borderColor = wav.borderColor || '#3b82f6';
    if (S.wShowA !== undefined) wav.show = !!S.wShowA;
    // title/subtitle/overlay/ping preserved via merge (no Vela controls).

    // ---- Goodbye (full backend incl. image card) ----
    const g = w.goodbye = w.goodbye || {};
    if (S.gOn !== undefined) g.enabled = !!S.gOn;
    if (S.gMsg !== undefined) g.message = String(S.gMsg);
    const gChId = needChan('Goodbye channel', S.gCh);
    if (gChId) g.channelId = gChId;
    const gc = g.card = g.card || {};
    gc.enabled = true;
    if (S.gImg !== undefined) gc.background = String(S.gImg);
    const gl = layoutToPx(S, 'g');
    const gu = gc.username = gc.username || {};
    gu.text = '{username}';
    gu.x = clamp(gl.nx, 0, 800); gu.y = clamp(gl.ny, 0, 350); gu.fontSize = clamp(gl.ns, 8, 120);
    gu.color = gu.color || '#ffffff'; gu.align = 'center';
    if (S.gShowN !== undefined) gu.show = !!S.gShowN;
    const gav = gc.avatar = gc.avatar || {};
    gav.x = clamp(gl.ax, 0, 800); gav.y = clamp(gl.ay, 0, 350); gav.size = clamp(gl.as, 20, 400);
    gav.shape = gav.shape || 'circle';
    if (gav.borderWidth === undefined) gav.borderWidth = 4;
    gav.borderColor = gav.borderColor || '#3b82f6';
    if (S.gShowA !== undefined) gav.show = !!S.gShowA;

    // ---- Tickets (full mapping; every key has a real bot counterpart) ----
    if (S.tkOn !== undefined || S.tkMax !== undefined || S.tkPanelCh !== undefined ||
        S.tkEmbColor !== undefined || S.tkEmbImg !== undefined || S.tkThumb !== undefined || S.tkFooter !== undefined ||
        S.tkAnnounce !== undefined || S.tkInactiveMin !== undefined || S.tkClosedCat !== undefined || S.tkDeleteAfter !== undefined ||
        S.tkTransOn !== undefined || S.tkTransCat !== undefined || S.tkTransRole !== undefined ||
        S.tkClaimCh !== undefined || S.tkClaimFmt !== undefined ||
        S.tkCmdOn !== undefined || S.tkCmdAliases !== undefined || S.tkCmdCd !== undefined ||
        S.tkBtnClaim !== undefined || S.tkBtnClose !== undefined || S.tkBtnTransfer !== undefined || S.tkBtnDelete !== undefined || S.tkBtnNotify !== undefined ||
        S.tkBtnEmojiClaim !== undefined || S.tkBtnEmojiClose !== undefined || S.tkBtnEmojiTransfer !== undefined || S.tkBtnEmojiDelete !== undefined || S.tkBtnEmojiNotify !== undefined ||
        S.tkSections !== undefined || S.tkCustomBtns !== undefined) {
        const t = settings.ticket = settings.ticket || {};
        if (S.tkOn !== undefined) t.enabled = !!S.tkOn;
        t.buttons = t.buttons || {};
        if (S.tkBtnClaim !== undefined) t.buttons.claim = !!S.tkBtnClaim;
        if (S.tkBtnClose !== undefined) t.buttons.close = !!S.tkBtnClose;
        if (S.tkBtnTransfer !== undefined) t.buttons.transfer = !!S.tkBtnTransfer;
        if (S.tkBtnDelete !== undefined) t.buttons.delete = !!S.tkBtnDelete;
        if (S.tkBtnNotify !== undefined) t.buttons.notify = !!S.tkBtnNotify;
        t.buttonEmojis = t.buttonEmojis || {};
        [['tkBtnEmojiClaim', 'claim'], ['tkBtnEmojiClose', 'close'], ['tkBtnEmojiTransfer', 'transfer'], ['tkBtnEmojiDelete', 'delete'], ['tkBtnEmojiNotify', 'notify']].forEach(([k, b]) => {
            if (S[k] !== undefined) t.buttonEmojis[b] = String(S[k] || '').trim().slice(0, 20);
        });
        if (S.tkMax !== undefined) t.maxPerMember = Math.max(1, Math.round(num(S.tkMax, 1)));
        if (S.tkPanelCh !== undefined) {
            t.panel = t.panel || {};
            if (String(S.tkPanelCh).trim() === '') t.panel.channelId = '';
            else {
                const id = resolveChannel(S.tkPanelCh, channels);
                if (id) t.panel.channelId = id;
                else errors.push('Ticket panel channel: channel not found: ' + S.tkPanelCh);
            }
        }
        if (S.tkPanelStyle !== undefined) {
            t.panel = t.panel || {};
            const st = String(S.tkPanelStyle);
            t.panel.style = (st === 'Dropdown' || st === 'dropdown') ? 'dropdown' : (st === 'Both' || st === 'both') ? 'both' : 'buttons';
        }
        t.embed = t.embed || {};
        if (S.tkEmbColor !== undefined) {
            if (/^#[0-9a-fA-F]{6}$/.test(String(S.tkEmbColor))) t.embed.color = S.tkEmbColor;
            else errors.push('Ticket embed color: invalid color (use #rrggbb): ' + S.tkEmbColor);
        }
        if (S.tkEmbImg !== undefined) t.embed.image = String(S.tkEmbImg || '');
        if (S.tkThumb !== undefined) t.embed.thumbnail = String(S.tkThumb || '');
        if (S.tkFooter !== undefined) t.embed.footer = String(S.tkFooter || '');
        if (S.tkAnnounce !== undefined) t.announceNew = !!S.tkAnnounce;
        if (S.tkInactiveMin !== undefined) t.inactiveMinutes = Math.max(0, Math.round(num(S.tkInactiveMin, 0)));
        if (S.tkClosedCat !== undefined) t.closedCategoryId = String(S.tkClosedCat || '');
        if (S.tkDeleteAfter !== undefined) t.deleteAfterCloseSeconds = Math.max(0, Math.round(num(S.tkDeleteAfter, 5)));
        t.transfer = t.transfer || {};
        if (S.tkTransOn !== undefined) t.transfer.enabled = !!S.tkTransOn;
        if (S.tkTransCat !== undefined) t.transfer.categoryId = String(S.tkTransCat || '');
        if (S.tkTransRole !== undefined) {
            if (String(S.tkTransRole).trim() === '') t.transfer.roleId = '';
            else {
                const r = resolveRole(S.tkTransRole, roles);
                t.transfer.roleId = r || '';
            }
        }
        t.claimLog = t.claimLog || {};
        if (S.tkClaimCh !== undefined) {
            if (String(S.tkClaimCh).trim() === '') t.claimLog.channelId = '';
            else {
                const id = resolveChannel(S.tkClaimCh, channels);
                if (id) t.claimLog.channelId = id;
                else errors.push('Ticket claim log channel: channel not found: ' + S.tkClaimCh);
            }
        }
        if (S.tkClaimFmt !== undefined) t.claimLog.format = (S.tkClaimFmt === 'Plain text' ? 'text' : 'embed');
        const tc = t.command = t.command || { enabled: false, aliases: [], cooldown: 5, permissions: { enabledRoleIds: [], disabledRoleIds: [] } };
        if (S.tkCmdOn !== undefined) tc.enabled = !!S.tkCmdOn;
        if (S.tkCmdCd !== undefined) tc.cooldown = Math.max(0, Math.round(num(S.tkCmdCd, 5)));
        if (S.tkCmdAliases !== undefined) {
            tc.aliases = String(S.tkCmdAliases).split(',').map((a) => a.trim().toLowerCase().replace(/^[/!]+/, '')).filter((a, i, arr) => a && arr.indexOf(a) === i);
        }
        if (S.tkSections !== undefined && Array.isArray(S.tkSections)) {
            const seen = {};
            t.sections = S.tkSections
                .filter((s) => s && String(s.name || '').trim() !== '')
                .map((s) => ({
                name: String(s.name).trim().slice(0, 80),
                emoji: String(s.emoji || '🎫'),
                enabled: s.enabled !== false,
                categoryId: String(s.categoryId || ''),
                adminRoles: Array.isArray(s.adminRoles) ? s.adminRoles.map(String).filter((r) => r && !seen[r + s.name] && (seen[r + s.name] = 1)) : [],
                logChannelId: String(s.logChannelId || ''),
                imageUrl: String(s.imageUrl || '')
            }));
        }
        if (S.tkCustomBtns !== undefined && Array.isArray(S.tkCustomBtns)) {
            const seenIds = {};
            t.customButtons = S.tkCustomBtns
                .filter((x) => x && String(x.label || '').trim() !== '' && (x.kind || 'button') === 'button' && (x.type || 'link') === 'link')
                .map((x) => {
                let id = String(x.id || '').trim();
                if (!id || seenIds[id])
                    id = 'c' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
                seenIds[id] = 1;
                const item = {
                    id,
                    label: String(x.label).trim().slice(0, 80),
                    emoji: String(x.emoji || '').trim().slice(0, 20),
                    enabled: x.enabled !== false,
                    kind: 'button',
                    type: 'link',
                    commands: [],
                    url: '',
                    timeoutMinutes: 10,
                    name: ''
                };
                if (!/^https?:\/\//i.test(String(x.url || '')))
                    errors.push('Custom item "' + item.label + '": bad link URL (http(s)://).');
                item.url = String(x.url || '');
                return item;
            });
        }
    }
    // ---- Notifications (YouTube / Twitch / Kick) ----
    {
        const n = settings.notifications = settings.notifications || {};
        const clampMin = (v, d) => { const x = Math.round(num(v, d)); return Math.min(60, Math.max(2, x)); };
        const mapChan = (v) => {
            if (v === undefined || String(v).trim() === '') return undefined;
            const id = resolveChannel(v, channels);
            if (!id) errors.push('Notifications channel: channel not found: ' + v);
            return id;
        };
        const mapRole = (v) => {
            if (v === undefined || String(v).trim() === '') return undefined;
            return resolveRole(v, roles);
        };
        const y = n.youtube = n.youtube || {};
        if (S.ntYtOn !== undefined) y.enabled = !!S.ntYtOn;
        if (S.ntYtMin !== undefined) y.checkMinutes = clampMin(S.ntYtMin, 10);
        if (S.ntYtTpl !== undefined && String(S.ntYtTpl).trim() !== '') y.template = String(S.ntYtTpl);
        { const c = mapChan(S.ntYtCh); if (c !== undefined) y.discordChannelId = c || ''; }
        { const r = mapRole(S.ntYtRole); if (r !== undefined) y.mentionRoleId = r || ''; }
        if (S.ntYtAccts !== undefined && Array.isArray(S.ntYtAccts)) {
            const seen = {};
            y.channels = S.ntYtAccts
                .filter((a) => a && String(a.id || '').trim() !== '' && !seen[String(a.id).trim()] && (seen[String(a.id).trim()] = 1))
                .map((a) => ({ id: String(a.id).trim(), name: String(a.name || '').trim().slice(0, 100), enabled: a.enabled !== false }));
        }
        const tw = n.twitch = n.twitch || {};
        if (S.ntTwOn !== undefined) tw.enabled = !!S.ntTwOn;
        if (S.ntTwMin !== undefined) tw.checkMinutes = clampMin(S.ntTwMin, 3);
        if (S.ntTwTpl !== undefined && String(S.ntTwTpl).trim() !== '') tw.template = String(S.ntTwTpl);
        if (S.ntTwId !== undefined) tw.clientId = String(S.ntTwId || '').trim();
        if (S.ntTwSecret !== undefined) tw.clientSecret = String(S.ntTwSecret || '').trim();
        { const c = mapChan(S.ntTwCh); if (c !== undefined) tw.discordChannelId = c || ''; }
        { const r = mapRole(S.ntTwRole); if (r !== undefined) tw.mentionRoleId = r || ''; }
        if (S.ntTwAccts !== undefined && Array.isArray(S.ntTwAccts)) {
            const seen = {};
            tw.channels = S.ntTwAccts
                .filter((a) => a && String(a.login || '').trim() !== '' && !seen[String(a.login).trim().toLowerCase()] && (seen[String(a.login).trim().toLowerCase()] = 1))
                .map((a) => ({ login: String(a.login).trim().toLowerCase(), name: String(a.name || '').trim().slice(0, 100), enabled: a.enabled !== false }));
        }
        const k = n.kick = n.kick || {};
        if (S.ntKkOn !== undefined) k.enabled = !!S.ntKkOn;
        if (S.ntKkMin !== undefined) k.checkMinutes = clampMin(S.ntKkMin, 3);
        if (S.ntKkTpl !== undefined && String(S.ntKkTpl).trim() !== '') k.template = String(S.ntKkTpl);
        { const c = mapChan(S.ntKkCh); if (c !== undefined) k.discordChannelId = c || ''; }
        { const r = mapRole(S.ntKkRole); if (r !== undefined) k.mentionRoleId = r || ''; }
        if (S.ntKkAccts !== undefined && Array.isArray(S.ntKkAccts)) {
            const seen = {};
            k.channels = S.ntKkAccts
                .filter((a) => a && String(a.slug || '').trim() !== '' && !seen[String(a.slug).trim().toLowerCase()] && (seen[String(a.slug).trim().toLowerCase()] = 1))
                .map((a) => ({ slug: String(a.slug).trim().toLowerCase(), name: String(a.name || '').trim().slice(0, 100), enabled: a.enabled !== false }));
        }
    }
    // ---- Giveaways (real bits) ----
    const gw = settings.giveaway = settings.giveaway || {};
    if (S.gwWin !== undefined) gw.maxWinners = Math.max(1, Math.round(num(S.gwWin, 1)));
    if (S.gwCh !== undefined && String(S.gwCh).trim() !== '') {
        const id = resolveChannel(S.gwCh, channels);
        if (id) gw.allowedChannels = [id];
        else errors.push('Giveaway channel: channel not found: ' + S.gwCh);
    }
    if (S.gwRole !== undefined && String(S.gwRole).trim() !== '') gw.requiredRole = resolveRole(S.gwRole, roles);
    // ---- Auto roles (real bits) ----
    if (S.arOn !== undefined || S.arRole !== undefined || S.arBot !== undefined) {
        const ar = settings.autoRoles = settings.autoRoles || {};
        if (S.arOn !== undefined) { ar.enabled = !!S.arOn; }
        ar.members = ar.members || {}; ar.bots = ar.bots || {};
        if (S.arOn !== undefined) { ar.members.enabled = !!S.arOn; ar.bots.enabled = !!S.arOn; }
        if (S.arRole !== undefined && String(S.arRole).trim() !== '') {
            const r = resolveRole(S.arRole, roles);
            ar.members.roleIds = r ? [r] : [];
        }
        if (S.arBot !== undefined && String(S.arBot).trim() !== '') {
            const r = resolveRole(S.arBot, roles);
            ar.bots.roleIds = r ? [r] : [];
        }
    }
    // ---- Logging (real mapping) ----
    const logs = settings.logs = settings.logs || {};
    const lgCh = needChan('Log channel', S.lgCh);
    const setLogs = (types, flag) => {
        if (flag === undefined && !lgCh) return;
        types.forEach((t) => {
            logs[t] = logs[t] || {};
            if (lgCh) logs[t].channelId = lgCh;
            if (flag !== undefined) logs[t].enabled = !!flag;
        });
    };
    setLogs(['memberBan', 'memberKick', 'memberTimeout', 'memberUntimeout'], S.lgMod);
    setLogs(['messageDelete', 'messageEdit', 'messageBulkDelete', 'messageImage', 'messageImageDelete'], S.lgMsg);
    setLogs(['memberJoin', 'memberLeave'], S.lgMem);
    setLogs(['voiceJoin', 'voiceLeave', 'voiceMove'], S.lgVoice);
    setLogs(['roleCreate', 'roleDelete', 'roleUpdate', 'roleGive', 'roleRemove'], S.lgRole);
    // ---- Detailed per-event logs (old interface style: each event has its own channel+switch; overrides groups) ----
    const hexOk = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
    LOG_TYPES.forEach((t) => {
        const ck = 'lgch_' + t, ek = 'lgon_' + t, cc = 'lgco_' + t;
        if (S[ck] === undefined && S[ek] === undefined && S[cc] === undefined) return;
        logs[t] = logs[t] || {};
        if (S[ck] !== undefined && String(S[ck]).trim() !== '') {
            const id = resolveChannel(S[ck], channels);
            if (id) logs[t].channelId = id;
            else errors.push('Log ' + t + ': channel not found: ' + S[ck]);
        }
        if (S[ek] !== undefined) logs[t].enabled = !!S[ek];
        if (S[cc] !== undefined) {
            if (!hexOk(S[cc])) errors.push('Log ' + t + ': invalid color (use #rrggbb): ' + S[cc]);
            else logs[t].color = S[cc];
        }
        const pk = 'lgping_' + t, ic = 'lgigch_' + t, ir = 'lgigroles_' + t;
        if (S[pk] !== undefined || S[ic] !== undefined || S[ir] !== undefined) {
            const cleanRoleIds = (arr) => {
                if (!Array.isArray(arr)) return [];
                const out = [];
                arr.forEach((x) => {
                    const s = String(x || '').trim();
                    if (!s) return;
                    const id = resolveRole(s, roles);
                    if (id && roles.some((r) => String(r.id) === String(id)) && !out.includes(String(id))) out.push(String(id));
                });
                return out;
            };
            const cleanChanIds = (arr) => {
                if (!Array.isArray(arr)) return [];
                const out = [];
                arr.forEach((x) => {
                    const s = String(x || '').trim();
                    if (!s) return;
                    const id = resolveChannel(s, channels);
                    if (id && !out.includes(id)) out.push(id);
                });
                return out;
            };
            if (S[pk] !== undefined) logs[t].pingRoleIds = cleanRoleIds(S[pk]);
            if (S[ic] !== undefined) logs[t].ignoredChannelIds = cleanChanIds(S[ic]);
            if (S[ir] !== undefined) logs[t].ignoredRoleIds = cleanRoleIds(S[ir]);
        }
    });
    // ---- Protection (real bits) ----
    const prot = settings.protection = settings.protection || {};
    if (S.amOn !== undefined) prot.enabled = !!S.amOn;
    if (S.amSpam !== undefined) {
        prot.antispam = prot.antispam || { limits: {}, action: {} };
        prot.antispam.enabled = !!S.amSpam;
    }

    // ---- System Protection (from system/ folder, stored under settings.systemProtection) ----
    {
        const sp = settings.systemProtection = settings.systemProtection || {};
        const antis = ['sysAntiCreate','sysAntiDelete','sysAntiPerms','sysAntiWebhook','sysAntiBots','sysAntiSpam','sysAntiLink','sysAntiJoin'];
        antis.forEach(k => { if (S[k] !== undefined) sp[k] = !!S[k]; });
        const puns = ['sysPunishBan','sysPunishKick','sysPunishChanDel','sysPunishRoleDel','sysPunishChanCreate','sysPunishWebhook','sysPunishBotAdd'];
        puns.forEach(k => { if (S[k] !== undefined) sp[k] = String(S[k] || 'none'); });
        if (S.sysTimeoutMin !== undefined) sp.sysTimeoutMin = Math.max(1, Math.min(10080, Math.round(num(S.sysTimeoutMin, 10))));
        // Bypass roles
        ['sysBypassRole1','sysBypassRole2','sysBypassRole3'].forEach(k => {
            if (S[k] !== undefined) {
                const r = S[k] ? resolveRole(S[k], roles) : '';
                sp[k] = r || '';
            }
        });
        if (S.sysWordFilter !== undefined) sp.sysWordFilter = !!S.sysWordFilter;
        if (S.sysWordList !== undefined) sp.sysWordList = String(S.sysWordList || '');
    }
    // ---- Everything else: persisted verbatim under settings.vela ----
    const extra = {};
    Object.keys(S).forEach((k) => {
        if (EXTRA_KEYS.has(k)) extra[k] = S[k];
    });
    settings.vela = extra;
    return { settings, errors };
}

function stateFromSettings(settings, ctx) {
    const channels = (ctx && ctx.channels) || [];
    const S = {};
    S.lang = settings.defaultLanguage === 'ar' ? 'العربية' : 'English';
    settings.commands = settings.commands || {};
    COMMANDS.forEach(([name]) => {
        const c = settings.commands[name] || {};
        S['c_' + name] = c.enabled !== undefined ? !!c.enabled : true;
        S['cooldown_' + name] = c.cooldown !== undefined ? Math.max(0, Math.round(Number(c.cooldown) || 0)) : 5;
        S['aliases_' + name] = Array.isArray(c.aliases) ? c.aliases.join(', ') : '';
        const perms = c.permissions || {};
        S['allowroles_' + name] = Array.isArray(perms.enabledRoleIds) ? perms.enabledRoleIds.map(String) : [];
        S['denyroles_' + name] = Array.isArray(perms.disabledRoleIds) ? perms.disabledRoleIds.map(String) : [];
        const chs = c.channels || {};
        S['allowchats_' + name] = Array.isArray(chs.enabledChannelIds) ? chs.enabledChannelIds.map(String) : [];
        S['denychats_' + name] = Array.isArray(chs.disabledChannelIds) ? chs.disabledChannelIds.map(String) : [];
    });
    const w = settings.welcome || {};
    S.wOn = w.textEnabled !== undefined ? !!w.textEnabled : true;
    S.wMsg = w.message !== undefined ? String(w.message) : 'Welcome {user} to {server}! You are member #{count}.';
    S.wCh = w.channelId ? channelName(w.channelId, channels) : '';
    S.wImg = (w.card && w.card.background) || '';
    S.wBgMode = !w.card ? 'Transparent' : w.card.backgroundMode === 'solid' ? 'Solid' : w.card.backgroundMode === 'custom' ? 'Custom image' : 'Transparent';
    S.wBgColor = (w.card && w.card.backgroundColor) || '#14171c';
    S.wDm = !!(w.dm && w.dm.enabled);
    S.wShowN = !!(w.card && w.card.username && w.card.username.show !== false);
    S.wShowA = !!(w.card && w.card.avatar && w.card.avatar.show !== false);
    Object.assign(S, pxToVela(w.card, 'w'));
    const g = w.goodbye || {};
    S.gOn = !!g.enabled;
    S.gMsg = g.message !== undefined ? String(g.message) : '{user} has left {server}.';
    S.gCh = g.channelId ? channelName(g.channelId, channels) : '';
    S.gImg = (g.card && g.card.background) || '';
    S.gShowN = !!(g.card && g.card.username && g.card.username.show !== false);
    S.gShowA = !!(g.card && g.card.avatar && g.card.avatar.show !== false);
    Object.assign(S, pxToVela(g.card, 'g'));
    const t = settings.ticket || {};
    S.tkOn = !!t.enabled;
    const tb = t.buttons || {};
    S.tkBtnClaim = tb.claim !== undefined ? !!tb.claim : true;
    S.tkBtnClose = tb.close !== undefined ? !!tb.close : true;
    S.tkBtnTransfer = tb.transfer !== undefined ? !!tb.transfer : true;
    S.tkBtnDelete = !!tb.delete;
    S.tkBtnNotify = !!tb.notify;
    S.tkMax = t.maxPerMember !== undefined ? t.maxPerMember : 1;
    S.tkPanelCh = (t.panel && t.panel.channelId) ? channelName(t.panel.channelId, channels) : '';
    S.tkPanelStyle = (t.panel && t.panel.style) === 'dropdown' ? 'Dropdown' : (t.panel && t.panel.style) === 'both' ? 'Both' : 'Buttons';
    S.tkEmbColor = (t.embed && t.embed.color) || '#3498db';
    S.tkEmbImg = (t.embed && t.embed.image) || '';
    S.tkThumb = (t.embed && t.embed.thumbnail) || '';
    S.tkFooter = (t.embed && t.embed.footer) || '';
    S.tkAnnounce = !!t.announceNew;
    S.tkInactiveMin = t.inactiveMinutes !== undefined ? t.inactiveMinutes : 0;
    S.tkClosedCat = t.closedCategoryId || '';
    S.tkDeleteAfter = t.deleteAfterCloseSeconds !== undefined ? t.deleteAfterCloseSeconds : 5;
    S.tkTransOn = !!(t.transfer && t.transfer.enabled);
    S.tkTransCat = (t.transfer && t.transfer.categoryId) || '';
    S.tkTransRole = (t.transfer && t.transfer.roleId) || '';
    S.tkClaimCh = (t.claimLog && t.claimLog.channelId) ? channelName(t.claimLog.channelId, channels) : '';
    S.tkClaimFmt = (t.claimLog && t.claimLog.format) === 'text' ? 'Plain text' : 'Embed';
    const tc = t.command || {};
    S.tkCmdOn = !!tc.enabled;
    S.tkCmdCd = tc.cooldown !== undefined ? tc.cooldown : 5;
    S.tkCmdAliases = Array.isArray(tc.aliases) ? tc.aliases.join(', ') : '';
    S.tkSections = Array.isArray(t.sections) ? JSON.parse(JSON.stringify(t.sections)) : [];
    S.tkCustomBtns = Array.isArray(t.customButtons) ? JSON.parse(JSON.stringify(t.customButtons)) : [];
    const bem = (t.buttonEmojis || {});
    S.tkBtnEmojiClaim = bem.claim || '👋';
    S.tkBtnEmojiClose = bem.close || '🔒';
    S.tkBtnEmojiTransfer = bem.transfer || '🔀';
    S.tkBtnEmojiDelete = bem.delete || '🗑️';
    S.tkBtnEmojiNotify = bem.notify || '🔔';
    const nt = settings.notifications || {};
    const ny = nt.youtube || {};
    S.ntYtOn = !!ny.enabled;
    S.ntYtMin = ny.checkMinutes !== undefined ? ny.checkMinutes : 10;
    S.ntYtTpl = ny.template || '';
    S.ntYtCh = ny.discordChannelId ? channelName(ny.discordChannelId, channels) : '';
    S.ntYtRole = ny.mentionRoleId || '';
    S.ntYtAccts = Array.isArray(ny.channels) ? JSON.parse(JSON.stringify(ny.channels)) : [];
    const nw = nt.twitch || {};
    S.ntTwOn = !!nw.enabled;
    S.ntTwMin = nw.checkMinutes !== undefined ? nw.checkMinutes : 3;
    S.ntTwTpl = nw.template || '';
    S.ntTwId = nw.clientId || '';
    S.ntTwSecret = nw.clientSecret || '';
    S.ntTwCh = nw.discordChannelId ? channelName(nw.discordChannelId, channels) : '';
    S.ntTwRole = nw.mentionRoleId || '';
    S.ntTwAccts = Array.isArray(nw.channels) ? JSON.parse(JSON.stringify(nw.channels)) : [];
    const nk = nt.kick || {};
    S.ntKkOn = !!nk.enabled;
    S.ntKkMin = nk.checkMinutes !== undefined ? nk.checkMinutes : 3;
    S.ntKkTpl = nk.template || '';
    S.ntKkCh = nk.discordChannelId ? channelName(nk.discordChannelId, channels) : '';
    S.ntKkRole = nk.mentionRoleId || '';
    S.ntKkAccts = Array.isArray(nk.channels) ? JSON.parse(JSON.stringify(nk.channels)) : [];
    const gw = settings.giveaway || {};
    S.gwCh = (gw.allowedChannels && gw.allowedChannels[0]) ? channelName(gw.allowedChannels[0], channels) : '';
    S.gwRole = gw.requiredRole || '';
    S.gwWin = gw.maxWinners || 1;
    const ar = settings.autoRoles || {};
    S.arOn = !!ar.enabled;
    S.arRole = ((ar.members && ar.members.roleIds && ar.members.roleIds[0]) || '');
    S.arBot = ((ar.bots && ar.bots.roleIds && ar.bots.roleIds[0]) || '');
    const logs = settings.logs || {};
    S.lgCh = channelName((logs.messageDelete && logs.messageDelete.channelId) || '', channels);
    S.lgMod = !!(logs.memberBan && logs.memberBan.enabled);
    S.lgMsg = !!(logs.messageDelete && logs.messageDelete.enabled);
    S.lgMem = !!(logs.memberJoin && logs.memberJoin.enabled);
    S.lgVoice = !!(logs.voiceJoin && logs.voiceJoin.enabled);
    S.lgRole = !!(logs.roleCreate && logs.roleCreate.enabled);
    // Detailed per-event state (old interface style).
    LOG_TYPES.forEach((lt) => {
        const l = logs[lt] || {};
        S['lgch_' + lt] = l.channelId ? channelName(l.channelId, channels) : '';
        S['lgon_' + lt] = !!l.enabled;
        S['lgco_' + lt] = (typeof l.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(l.color)) ? l.color : '#a9b9d8';
        S['lgping_' + lt] = Array.isArray(l.pingRoleIds) ? l.pingRoleIds.map(String) : [];
        S['lgigch_' + lt] = Array.isArray(l.ignoredChannelIds) ? l.ignoredChannelIds.map(String) : [];
        S['lgigroles_' + lt] = Array.isArray(l.ignoredRoleIds) ? l.ignoredRoleIds.map(String) : [];
    });
    const prot = settings.protection || {};
    S.amOn = prot.enabled !== undefined ? !!prot.enabled : true;
    S.amSpam = !!(prot.antispam && prot.antispam.enabled);
    // ---- System Protection state ----
    const sp = settings.systemProtection || {};
    S.sysAntiCreate = !!sp.sysAntiCreate;
    S.sysAntiDelete = !!sp.sysAntiDelete;
    S.sysAntiPerms = !!sp.sysAntiPerms;
    S.sysAntiWebhook = !!sp.sysAntiWebhook;
    S.sysAntiBots = !!sp.sysAntiBots;
    S.sysAntiSpam = !!sp.sysAntiSpam;
    S.sysAntiLink = !!sp.sysAntiLink;
    S.sysAntiJoin = !!sp.sysAntiJoin;
    S.sysPunishBan = sp.sysPunishBan || 'none';
    S.sysPunishKick = sp.sysPunishKick || 'none';
    S.sysPunishChanDel = sp.sysPunishChanDel || 'none';
    S.sysPunishRoleDel = sp.sysPunishRoleDel || 'none';
    S.sysPunishChanCreate = sp.sysPunishChanCreate || 'none';
    S.sysPunishWebhook = sp.sysPunishWebhook || 'none';
    S.sysPunishBotAdd = sp.sysPunishBotAdd || 'none';
    S.sysTimeoutMin = sp.sysTimeoutMin !== undefined ? sp.sysTimeoutMin : 10;
    S.sysBypassRole1 = sp.sysBypassRole1 || '';
    S.sysBypassRole2 = sp.sysBypassRole2 || '';
    S.sysBypassRole3 = sp.sysBypassRole3 || '';
    S.sysWordFilter = !!sp.sysWordFilter;
    S.sysWordList = sp.sysWordList || '';
    Object.assign(S, (settings.vela && typeof settings.vela === 'object') ? settings.vela : {});
    return S;
}

function pxToVela(card, p) {
    const out = {};
    const lay = pxToLayout(card);
    out[p + 'Nx'] = lay.Nx; out[p + 'Ny'] = lay.Ny; out[p + 'Ns'] = lay.Ns;
    out[p + 'Ax'] = lay.Ax; out[p + 'Ay'] = lay.Ay; out[p + 'As'] = lay.As;
    return out;
}

exports.applyVelaState = applyVelaState;
exports.stateFromSettings = stateFromSettings;
