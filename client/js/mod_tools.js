var actionTemplates = null;

var actions = {
    user: {
        ban: {
            url: "mod/toggle_ban",
            btnStyle: "danger",
            callback: function(data, elem) {
                elem.text(`${data.banned ? "Unban" : "Ban"}`);
            },
            buttonText: function(data) {
                return data.banned ? "Unban" : "Ban";
            }
        },
        activation: {
            url: "mod/toggle_active",
            btnStyle: "warning",
            callback: function(data, elem) {
                elem.text(`${data.deactivated ? "Activate" : "Deactivate"}`);
            },
            buttonText: function(data) {
                return data.deactivated ? "Activate" : "Deactivate";
            }
        },
        mod: {
            url: "admin/toggle_mod",
            btnStyle: "info",
            adminOnly: true,
            callback: function(data, elem) {
                elem.text(`${data.moderator ? "Remove" : "Give"} Moderator`);
            },
            buttonText: function(data) {
                return `${data.moderator ? "Remove" : "Give"} Moderator`
            }
        }
    },
    server: {
        reloadConfig: {
            url: "admin/reload_config",
            btnStyle: "success",
            adminOnly: true,
            callback: (data, elem) => {
                elem.text(actions.server.reloadConfig.buttonText(data));
                alert("Successfully reloaded configuration from file.")
            },
            buttonText: data => "Reload Config"
        },
        refreshClients: {
            url: "admin/refresh_clients",
            btnStyle: "danger",
            adminOnly: true,
            callback: (data, elem) => {
                elem.text(actions.server.refreshClients.buttonText(data));
                alert("Successfully refreshed all clients currently connected to websockets.")
            },
            buttonText: data => "Refresh All Clients"
        }
    }
}
var renderAction = function(actionName, data = {}, type = "user") {
    var action = actions[type][actionName];
    return `<a href="javascript:void(0)" class="btn btn-${action.btnStyle} ${type}-action-btn" data-admin-only=${action.adminOnly === true} data-${type}-action="${actionName}">${action.buttonText(data)}</a>`;
}

var renderUserActions = function(user) {
    var currentUserID = $("body").data("user-id");
    var currentIsAdmin = $("body").data("user-is-admin");
    var currentIsMod = $("body").data("user-is-mod");
    var canTouchUser = (currentIsMod && !(user.moderator || user.admin)) || (currentIsAdmin && !user.admin);
    if(user._id) user.id = user._id;
    if(currentUserID == user.id || !canTouchUser) return ``;
    return `<div class="actions-ctn" data-user-id="${user.id}">
        <a href="/admin/users/similar/${user.id}" class="btn btn-warning">View Similar</a>
        ${renderAction("ban", user)}
        ${renderAction("activation", user)}
        ${renderAction("mod", user)}
    </div>`
}

var renderServerActions = function() {
    return `<div class="actions-ctn">
        ${renderAction("reloadConfig", {}, "server")}
        ${renderAction("refreshClients", {}, "server")}
        <a href="javascript:void(0);" class="btn btn-info" data-toggle="modal" data-target="#broadcastModal">Broadcast message</button>
    </div>`
}

$("body").on("click", ".user-action-btn", function() {
    function handleError(data) {
        var error = "An unknown error occurred."
        if(data && typeof data.error !== 'undefined' && data.error.message) error = data.error.message;
        alert("Couldn't perform action on user: " + error);
    }
    var userID = $(this).parent().data("user-id");
    var action = actions.user[$(this).data("user-action")];
    var originalText = $(this).html();
    $(this).addClass("disabled");
    $(this).html(`<i class="fa fa-circle-o-notch fa-spin"></i> ${originalText}`);
    var elem = $(this);
    $.get(`/api/${action.url}/`, {id: userID}).done(function(data) {
        if(!data.success) return handleError(data);
        action.callback(data, elem);
    }).fail(function(res) {
        handleError(typeof res.responseJSON === 'undefined' ? null : res.responseJSON);
        if(action.callbackModifiesText !== false) elem.html(originalText);
    }).always(function() {
        elem.removeClass("disabled");
        if(action.callbackModifiesText === false) elem.html(originalText);
    });
});


$("body").on("click", ".server-action-btn", function() {
    function handleError(data) {
        var error = "An unknown error occurred."
        if(data && typeof data.error !== 'undefined' && data.error.message) error = data.error.message;
        alert("Couldn't perform action: " + error);
    }
    var action = actions.server[$(this).data("server-action")];
    var originalText = $(this).html();
    $(this).addClass("disabled");
    $(this).html(`<i class="fa fa-circle-o-notch fa-spin"></i> ${originalText}`);
    var elem = $(this);
    $.get(`/api/${action.url}/`).done(function(data) {
        if(!data.success) return handleError(data);
        action.callback(data, elem);
    }).fail(function(res) {
        handleError(typeof res.responseJSON === 'undefined' ? null : res.responseJSON);
        if(action.callbackModifiesText !== false) elem.html(originalText);
    }).always(function() {
        elem.removeClass("disabled");
        if(action.callbackModifiesText === false) elem.html(originalText);
    });
});


$("#broadcastForm").submit(function(e) {
    e.preventDefault();
    $.post("/api/admin/broadcast", {
        title: $(this).find("#inputBroadcastTitle").val(),
        message: $(this).find("#inputBroadcastMessage").val(),
        style: $(this).find("#inputBroadcastStyle").val(),
        timeout: $(this).find("#inputBroadcastTimeout").val()
    }).done(function(data) {
        if(!data.success) return alert("Couldn't send broadcast");
        $('#broadcastModal').modal('hide');
        alert("Successfully sent out broadcast to all connected clients.");
    }).fail(function() {
        alert("Couldn't send broadcast");
    })
})

function getRowForAction(action) {
    var actionTemplate = actionTemplates[action.action];
    var randomString = function(length) {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for(var i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
    function parseActionTemplate(template, action) {
        return eval('`' + template.replace(/\${/g, '${action.info.') + '`');
    }

    var row = $("<div>").addClass("action").attr("data-action-id", action.id);
    var username = "<strong>Deleted user</strong>";
    var actionTxt = `<span class="action-str" title="${actionTemplate.displayName} - ${actionTemplate.category}">${actionTemplate.inlineDisplayName.toLowerCase()}`;
    if(action.performingUser) username = `<strong><a href="/@${action.performingUser.username}">${action.performingUser.username}</a></strong>`;
    var moreInfoCtn = null;
    var sentenceEnd = "";
    var otherLines = "";
    if(Object.keys(action.info).length > 0) {
        if(typeof actionTemplate.sentenceEndTextFormatting !== 'undefined') sentenceEnd = parseActionTemplate(actionTemplate.sentenceEndTextFormatting, action);
        if(typeof actionTemplate.otherLinesTextFormatting !== 'undefined') otherLines = "<br>" + parseActionTemplate(actionTemplate.otherLinesTextFormatting, action);
        if(typeof actionTemplate.hideInfo === 'undefined' || !actionTemplate.hideInfo) {
            var moreInfoCtn = $("<div>").addClass("info-collapse-ctn");
            var id = `info-collapse-${randomString(16)}-${action.id}`;
            var infoCtn = $("<div>").addClass("collapse info-collapse").attr("id", id).appendTo(moreInfoCtn);
            var infoList = $("<ol>").appendTo(infoCtn);
            Object.keys(action.info).forEach(key => {
                var value = action.info[key];
                if(typeof value !== 'object') {
                    var thisRow = $("<li>").appendTo(infoList);
                    $("<code>").text(key).appendTo(thisRow);
                    $("<span>").text(`: ${value}`).appendTo(thisRow);
                }
            })
            var seeMoreLink = $("<a>").attr("role", "button").addClass("see-more-toggle").attr("data-toggle", "collapse").attr("href", `#${id}`).attr("aria-expanded", "false").attr("aria-controls", id).text("See more").appendTo(moreInfoCtn);
            infoCtn.on("show.bs.collapse", () => seeMoreLink.text("See less")).on("hide.bs.collapse", () => seeMoreLink.text("See more"))
        }
    }
    var text = `${username} ${actionTxt}${sentenceEnd}</span>.${otherLines}`;
    if(typeof actionTemplate.requiresModerator !== 'undefined' && actionTemplate.requiresModerator) {
        var modUsername = "<strong>Deleted moderator</strong>"
        if(action.moderatingUser) modUsername = `<strong><a href="/@${action.moderatingUser.username}">${action.moderatingUser.username}</a></strong>`;
        var text = `${modUsername} ${actionTxt} ${username}${sentenceEnd}</span>.${otherLines}`
    }
    $("<p>").addClass("text").html(text).appendTo(row);
    if(moreInfoCtn) moreInfoCtn.appendTo(row);
    $("<time>").addClass("timeago").attr("datetime", action.date).attr("title", new Date(action.date).toLocaleString()).text($.timeago(action.date)).appendTo(row);
    return row;
}

function fetchActions(lastID, modOnly, limit, callback) {
    $.get("/api/mod/actions", {lastID: lastID, limit: limit, modOnly: modOnly}).done(function(data) {
        if(!data.success || !data.actions || !data.actionTemplates) return callback(null);
        actionTemplates = data.actionTemplates;
        callback(data.actions, data.lastID);
    }).fail(function() {
        callback(null, null);
    });
}

function addToContainerForResponse(container, data, lastID, modOnly, limit, allowsShowMore) {
    data.forEach(action => getRowForAction(action).appendTo(container));
    if(allowsShowMore && lastID) {
        var loading = false;
        $("<a>").addClass("btn btn-primary btn-xs").text("Load more").appendTo(container).on("click", function() {
            var btn = $(this);
            if(!loading) {
                loading = true;
                btn.html("<i class=\"fa fa-spin fa-circle-o-notch\"></i> Loading...").addClass("disabled");
                fetchActions(lastID, modOnly, limit, function(data, lastID) {
                    if(!data) {
                        loading = false;
                        return alert("Couldn't load more actions.")
                    }
                    btn.remove();
                    addToContainerForResponse(container, data, lastID, modOnly, limit, allowsShowMore);
                })
            }
        })
    }
}

function loadRecentActionsIntoContainer(container, limit = null, modOnly = false, allowsShowMore = true) {
    container.html("<i class=\"fa fa-spin fa-circle-o-notch\"></i> Loading...");
    fetchActions(null, modOnly, limit, function(data, lastID) { 
        if(!data) return $(container).text("Couldn't load mod actions");
        container.html("");
        addToContainerForResponse(container, data, lastID, modOnly, limit, allowsShowMore);
    });
}