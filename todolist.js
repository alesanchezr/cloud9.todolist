//TODO 
// -- Hook up changing it into folders rather than file listing (nesting)
// -- Hook up icons
// -- Add options what to search on (workspace is current default) UI at the top!
// -- Add option to change regex as well as ignore folders (in the UI at the top)
// -- Decide if we want to reload ecah time!
// -- sort out showing errors with C9 console (top bar)
// -- Fix it to find tab in existing panel rather than opening another one

define(function(require, exports, module) {
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

        // Register the editor
        var todoList = editors.register("todoList", "todoList", TodoListEditor, []);

        //Setup our menu hooks!
        todoList.on("load", function() {
    		var menu = tabs.getElement("mnuEditors");
    		
    		//Setup our command!
    		commands.addCommand({
				name: "todoList_open",
				bindKey: { mac: "Command-T", win: "Ctrl-T" },
				isAvailable: function(){ return true; },
			}, todoList);
    		
    		//Add menu to the plu in tab list!
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

            //It's been activiated, init the search!
            //TODO decide if we want to refresh this each activiation.
            plugin.on('documentActivate', function(e) {
                
                var doc = e.doc;
                var session = doc.getSession();
  
                //Init our tree
                session.treeData = {label:"root",items:[]};
                treeUpdate(session.treeData);
                
				doc.tab.classList.add("loading");
				var reBase = new RegExp("^" + util.escapeRegExp(find.basePath), "gm");
				
				find.findFiles({
				        //Sourced from : https://github.com/regexhq/todo-regex
						query:'<!--[ \t]*@?(?:todo|fixme):?[ \t]*([^\n]+)[ \t]*-->|(?:@|\/\/[ \t]*)?(?:todo|fixme):?[ \t]*([^\n]+)',
						regexp:true
					}
					, function(err, stream, process) {
						if (err) {
						    //TODO get this error handled
							c9console.error(err);
							doc.tab.classList.remove("loading");
							doc.classList.add("error");
							return 
						}

						var filePath = '',todos = [];
						
						stream.on("data", function(chunk) {
						    
						    var parts = chunk.split('\n');
						    parts.forEach(function(line) {
						        //This is each line fo our data!
						        line = line.trim();
						        if (line === '') return true;
						        
						        //Is it to a file ?
						        if (line.substring(0,1)=== '/') {
									//New file!
									if (filePath !== '') { 
									    session.treeData.items.push({
                                            label: filePath
                                            ,items: todos
                                            ,path: filePath
                                        });
                                        treeUpdate(session.treeData);
									}
									//Take last char off, it's :
									filePath = line.replace(reBase, "").slice(0, -1)
									todos = [];
						        } else {
						            //Split it with a limit and add
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

            //Document is loaded (eg new area created)
            //Handle any UI tweaks we want here (this happnes once)
            plugin.on("documentLoad", function(e){
                
                var doc = e.doc;
                var session = doc.getSession();
                
                //Since our doc has not values we can ignore these
                //IF we change from loading each activate, we need to use these
                /*
                doc.on("setValue", function get(e) {}, session);
                doc.on("getValue", function get(e) {return ;}, session);
                */
                
                //Fix tab title on restoring tab
                doc.tab.on("setPath", setTitle, session);
                function setTitle(e) {doc.title = 'Todo List';}
                setTitle();

                //Based on C9 example code to deal with themes!
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

                //Insert data grid into container!
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
    			        //TODO Fix up folder icons <span class='filetree-icon folder'></span>
    			        return "<span class='dbgVarIcon'></span>";
    			    }
    			}, plugin);
    			
    			//Trying to set CSS to get the right icons!
    			treeDataGrid.renderer.setTheme({cssClass: "filetree"});
    			
    			//When the item is double clicked!
    			treeDataGrid.on("afterChoose", function(opts) { 
    			    var sel = treeDataGrid.selection.getSelectedNodes();
    			    sel.forEach(function(node) {
    			        //TODO fix this so when we sort by folder clicking folder stops!
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
            
            /*
            Use to store state for restoring if we add things to allow that!
            plugin.on("getState", function(e) {
                var session = e.doc.getSession();
                e.state.value = 'test';
            });
            plugin.on("setState", function(e) {
                var session = e.doc.getSession();
                session.value = e.state.value;
            });
            */

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