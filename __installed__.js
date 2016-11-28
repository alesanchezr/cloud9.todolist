define("plugins/cloud9.todolist/__installed__", [],[
    {
        "packagePath": "plugins/cloud9.todolist/todolist"
    }
]);

define("plugins/cloud9.todolist/todolist",[], function(require, exports, module) {
    main.consumes = [
		"Plugin", "Editor", "editors", "commands", "menus", "layout", "util",
		"settings", "ui", "proc", "c9", "preferences", "tabManager",
		"dialog.error", "dialog.question", "dialog.alert", "find","console","Datagrid"
	]
    main.provides = ["todoList"];
    return main;

    function main(options, imports, register) {

        var Editor = imports.Editor;
        var editors = imports.editors;
        var settings = imports.settings;
        var layout = imports.layout;
        var ui = imports.ui;
        var Datagrid = imports.Datagrid;
		var util = imports.util;
		var menus = imports.menus;
		var commands = imports.commands;
		var tabs = imports.tabManager;
		var find = imports.find;
		var c9console = imports.console;
        var basename = require("path").basename;
        var todoList = editors.register("todoList", "todoList", TodoListEditor, []);
        todoList.on("load", function() {
    		var menu = tabs.getElement("mnuEditors");
    		commands.addCommand({
				name: "todoList_open",
				bindKey: { mac: "Command-T", win: "Ctrl-T" },
				isAvailable: function(){ return true; },
			}, todoList);
    		menus.addItemToMenu(menu, 
    			new ui.item({
    				caption: "Todo List",
    				hotkey:"{commands.commandManager.todoList_open}",
    				onclick: function(e) {
    				    tabs.open({
            				active: true,
            				pane: this.parentNode.pane,
            				editorType: "todoList",
            				document: {
            					meta: {
            					    title: 'Todo List',
            						ignoreSave: true
            					}
            				},
            			}, function() {});
    				    
    				    
    				} 
    	        }), 200, todoList);
        });        

        function TodoListEditor(){

            var plugin = new Editor("Todo List", main.consumes, []);

            var treeDataGrid;
            plugin.on('documentActivate', function(e) {
                
                var doc = e.doc;
                var session = doc.getSession();
                session.treeData = {label:"root",items:[]};
                treeUpdate(session.treeData);
                
				doc.tab.classList.add("loading");
				var reBase = new RegExp("^" + util.escapeRegExp(find.basePath), "gm");
				
				find.findFiles({
						query:'<!--[ \t]*@?(?:todo|fixme):?[ \t]*([^\n]+)[ \t]*-->|(?:@|\/\/[ \t]*)?(?:todo|fixme):?[ \t]*([^\n]+)',
						regexp:true
					}
					, function(err, stream, process) {
						if (err) {
							c9console.error(err);
							doc.tab.classList.remove("loading");
							doc.classList.add("error");
							return 
						}

						var filePath = '',todos = [];
						
						stream.on("data", function(chunk) {
						    
						    var parts = chunk.split('\n');
						    parts.forEach(function(line) {
						        line = line.trim();
						        if (line === '') return true;
						        if (line.substring(0,1)=== '/') {
									if (filePath !== '') { 
									    session.treeData.items.push({
                                            label: filePath
                                            ,items: todos
                                            ,path: filePath
                                        });
                                        treeUpdate(session.treeData);
									}
									filePath = line.replace(reBase, "").slice(0, -1)
									todos = [];
						        } else {
						            var details = line.split(':');
						            var lineNo = details.shift().trim()
						            var todo = details.join(':').trim()
						            todos.push({line: lineNo, label: todo, path: filePath});
						        }
 
						    })

						});
						stream.on("end", function(data) {
							doc.tab.classList.remove("loading");
							doc.tab.classList.add("changed");
							
						});
					});
                
            });
            plugin.on("documentLoad", function(e){
                
                var doc = e.doc;
                var session = doc.getSession();
                doc.tab.on("setPath", setTitle, session);
                function setTitle(e) {doc.title = 'Todo List';}
                setTitle();
                function setTheme(e) {
                    var tab = doc.tab;
                    var isDark = e.theme == "dark";
                    var BGCOLOR = { 
                        "flat-light": "#F1F1F1", 
                        "light": "#D3D3D3", 
                        "light-gray": "#D3D3D3",
                        "dark": "#3D3D3D",
                        "dark-gray": "#3D3D3D" 
                    };
                    tab.backgroundColor = BGCOLOR[e.theme];
                    if (isDark) tab.classList.add("dark");
                    else tab.classList.remove("dark");
                }
                layout.on("themeChange", setTheme, session);
                setTheme({ theme: settings.get("user/general/@skin") });

            });

    		plugin.on("unload", function() {});
           
            plugin.on("draw", function(e) {
                treeDataGrid = new Datagrid({
    			    container: e.htmlNode,
    			    columns : [
    			        {
    			            caption: "File",
    			            value: "file",
    			            width: "90%",
    			            type: "tree"
    			        }, 
    			        {
    			            caption: "Line",
    			            value: "line",
    			            width: "55"
    			        }
    			    ],
    			    getIconHTML: function(node) {
    			        return "<span class='dbgVarIcon'></span>";
    			    }
    			}, plugin);
    			treeDataGrid.renderer.setTheme({cssClass: "filetree"});
    			treeDataGrid.on("afterChoose", function(opts) { 
    			    var sel = treeDataGrid.selection.getSelectedNodes();
    			    sel.forEach(function(node) {
                        if (!node || node.isFolder)
                            return;
                
                        var pane = tabs.focussedTab && tabs.focussedTab.pane;
                        if (tabs.getPanes(tabs.container).indexOf(pane) == -1)
                            pane = null;

                        var jump = (node.line) ? {row:parseInt(node.line,10)-1, column: 0} : {};

                        tabs.open({
                            path: node.path,
                            pane: pane,
                            noanim: sel.length > 1,
                            active: true,
                            focus: true,
                            document: {
                                ace: {
                                    jump: jump
                                }
                            }
                        }, function(){});
                    });

    			});
    			
    		
            });
           
           plugin.on("resize", function(){
                treeDataGrid.resize();
            });

            function treeUpdate(data) {
                treeDataGrid.setRoot(data);
                treeDataGrid.refresh();
            }
            
            
            plugin.load(null, "todoList");

            return plugin;
        }
        
        todoList.freezePublicAPI({

        });
            
        register(null, {
            "todoList": todoList
        });
    }
});
