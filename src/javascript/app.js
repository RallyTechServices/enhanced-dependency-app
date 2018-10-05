Ext.define("enhanced-dependency-app", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),

    piLevel0Name: 'Feature',

    launch: function() {
        this._addComponents();
        this.on('ready', function() {
            if (this._hasReleaseScope() || this._hasMilestoneScope()) {
                this._update();
            }
        }, this);
    },
    _addComponents: function() {
        this.removeAll();

        var selectorBox = this.add({
            //cls: 'rui-leftright',
            xtype: 'container',
            layout: 'hbox'
        });

        var filterBox = this.add({
            xtype: 'container',
            itemId: 'filter_box',
            flex: 1
        });


        this.add({
            xtype: 'container',
            itemId: 'display_box'
        });

        if (this._getSelectorType()) {
            selectorBox.add({
                xtype: this._getSelectorType(),
                fieldLabel: 'Release',
                labelAlign: 'right',
                margin: '10 5 10 5',
                labelWidth: 75,
                width: 400,
                storeConfig: {
                    context: { projectScopeDown: false }
                },
                listeners: {
                    scope: this,
                    change: this._update
                }
            });

        }

        var fp = selectorBox.add({
            xtype: 'fieldpickerbutton',
            modelNames: ['HierarchicalRequirement'],
            context: this.getContext(),
            margin: '10 5 10 5',
            stateful: true,
            stateId: 'grid-columns',
            _fields: [this.piLevel0Name, 'FormattedID', 'Name', 'ScheduleState', 'Iteration']
        });
        fp.on('fieldsupdated', this._update, this);

        var ft = selectorBox.add({
            xtype: 'rallyinlinefilterbutton',
            modelNames: ['HierarchicalRequirement'],
            context: this.getContext(),
            margin: '10 5 10 5',
            stateful: true,
            stateId: 'grid-filters-3',
            listeners: {
                inlinefilterready: this._addInlineFilterPanel,
                scope: this
            }
        });
        ft.on('inlinefilterchange', this._update, this);


        selectorBox.add({
            xtype: 'rallybutton',
            itemId: 'btn-export',
            iconCls: 'icon-export',
            cls: 'rly-small secondary',
            margin: '10 5 10 5',
            align: 'right',
            scope: this,
            handler: this._exportData
        });
    },
    _addInlineFilterPanel: function(panel) {
        this.down('#filter_box').add(panel);
    },
    _getSelectorType: function() {
        if (this._hasMilestoneScope() || this._hasReleaseScope()) {
            return null;
        }
        return 'rallyreleasecombobox';
    },
    _getTimeBoxRecord: function() {
        if (this.down('rallymilestonecombobox') && this.down('rallymilestonecombobox').getRecord()) {
            return this.down('rallymilestonecombobox').getRecord();
        }
        if (this.down('rallyreleasecombobox') && this.down('rallyreleasecombobox').getRecord()) {
            return this.down('rallyreleasecombobox').getRecord();
        }

        this.logger.log('_getTimeboxRecord', this.getContext().getTimeboxScope());

        if (this._hasMilestoneScope() || this._hasReleaseScope()) {
            return this.getContext().getTimeboxScope().getRecord() || null;
        }
        return null;
    },
    _hasTimeboxScope: function(type) {
        this.logger.log('_hasTimeboxScope', this.getContext().getTimeboxScope());
        if (this.getContext().getTimeboxScope() && this.getContext().getTimeboxScope().type.toLowerCase() === type.toLowerCase()) {
            return true;
        }
        return false;
    },
    _hasMilestoneScope: function() {
        return this._hasTimeboxScope('milestone');
    },
    _hasReleaseScope: function() {
        return this._hasTimeboxScope('release');
    },
    onTimeboxScopeChange: function(timeboxScope) {
        if (timeboxScope && (timeboxScope.getType().toLowerCase() === 'milestone' || timeboxScope.getType() === 'release')) {
            this.callParent(arguments);
            this._update()
        }
    },
    _exportData: function() {
        if (!this.down('#grid-dependencies')) {
            return;
        }

        var columnCfgs = this._getColumnCfgs(),
            headers = [];
        Ext.Array.each(columnCfgs, function(c) {
            headers.push(c.text);
        });
        var csv = [headers.join(',')];

        var store = this.down('#grid-dependencies').getStore();
        store.each(function(r) {
            var row = [];
            Ext.Array.each(columnCfgs, function(c) {
                var val = r.get(c.dataIndex);
                if (Ext.isObject(val)) {
                    if (val.FormattedID) {
                        val = Ext.String.format("{0}: {1}", val.FormattedID, val.Name);
                    }
                    else {
                        val = val.Name || val._refObjectName
                    }
                }
                row.push(val);
            });
            csv.push(row.join(','));
        });

        var file_name = Ext.String.format('dependencies-{0}.csv', Rally.util.DateTime.format(new Date(), 'Y-m-d-h-i-s'));
        CArABU.technicalservices.FileUtility.saveCSVToFile(csv.join('\r\n'), file_name);
    },
    _getTimeboxFilter: function() {
        var tbRecord = this._getTimeBoxRecord();
        this.logger.log('_getTimeBoxRecord', tbRecord);

        var filters = null;

        if (tbRecord && tbRecord.get('_type') === 'milestone') {
            filters = [{
                property: 'Milestones',
                value: tbRecord.get('_ref')
            }, {
                property: this.piLevel0Name + '.Milestones',
                value: tbRecord.get('_ref')
            }];
            filters = Rally.data.wsapi.Filter.or(filters);
        }

        if (tbRecord && tbRecord.get('_type') === 'release') {
            filters = [{
                property: 'Release.Name',
                value: tbRecord.get('Name')
            }, {
                property: this.piLevel0Name + '.Release.Name',
                value: tbRecord.get('Name')
            }];
            filters = Rally.data.wsapi.Filter.or(filters);
        }

        //rallyinlinefilterbutton
        if (filters) {
            filters = filters.and({
                property: 'DirectChildrenCount',
                value: 0
            });

            var filterButton = this.down('rallyinlinefilterbutton');
            if (filterButton && filterButton.inlineFilterPanel && filterButton.getWsapiFilter()) {
                filters = filters.and(filterButton.getWsapiFilter());
            }
        }

        return filters;

    },
    _update: function() {

        this.down('#display_box').removeAll();

        if (!this._getTimeboxFilter()) {
            this.down('#display_box').add({
                xtype: 'container',
                html: '<div class="selector-msg"><span style="color:#888888;">Please select a valid Timebox.</span></div>'
            });
            return;
        }

        CArABU.technicalservices.ModelBuilder.build('HierarchicalRequirement', 'StoryPredecessor', this._getAdditionalPredecessorFields()).then({
            success: this._fetchData,
            failure: this._showErrorNotification,
            scope: this
        });
    },
    _getFetch: function(isPredecessorFetch) {
        var fields = this.down('fieldpickerbutton').getFields();
        this.logger.log('_getFetch', fields);
        return fields;
    },
    _getAdditionalPredecessorFields: function() {
        var fields = this.down('fieldpickerbutton').getFieldObjects(),
            hiddenFields = ['Predecessors', 'ObjectID'];

        this.logger.log('_getAdditionalPredecessorFields', fields);

        var additionalFields = [];
        Ext.Array.each(fields, function(f) {
            var allowedValues = null;
            if (!Ext.Array.contains(hiddenFields, f.name)) {
                if (f.name === 'ScheduleState') {
                    allowedValues = f.getAllowedValueStore();
                }
                var nf = {
                    name: 'P' + f.name,
                    displayName: 'Predecessor ' + f.displayName
                };
                if (allowedValues) {
                    nf.getAllowedValueStore = function() {
                        return allowedValues;
                    }
                }
                additionalFields.push(nf);
            }
        });
        this.logger.log('_getAdditionalPredecessorFields', additionalFields);
        return additionalFields;
    },
    _fetchData: function(model) {
        var filters = Ext.create('Rally.data.wsapi.Filter', {
                property: 'Predecessors.ObjectID',
                operator: '!=',
                value: null
            }),
            timeboxFilter = this._getTimeboxFilter();

        filters = filters.and(timeboxFilter);
        this.logger.log('_fetchData filters', filters, filters.toString());

        Ext.create('Rally.data.wsapi.Store', {
            model: model,
            fetch: this._getFetch(),
            filters: filters,
            limit: 'Infinity',
            context: { project: null }
        }).load({
            callback: this._loadPredecessors,
            scope: this
        });

    },
    _getColumnCfgs: function() {
        var fields = this.down('fieldpickerbutton').getFieldObjects();
        var cols = [];

        Ext.Array.each(fields, function(f) {
            var field_name = '__p' + f.name;

            var field = {
                dataIndex: field_name,
                text: 'Predecessor ' + f.displayName,
                tdCls: 'tspredecessor'
            };
            if (f.name === 'Name') {
                field.flex = 1;
            }
            var template = Rally.ui.renderer.RendererFactory.getRenderTemplate(f);
            field.renderer = function(v, m, r) {
                return template.apply(r.get('__predecessor'));
            }
            field.sortable = false;
            cols.push(field);
        });

        Ext.Array.each(fields, function(f) {
            var field = {
                dataIndex: f.name,
                text: f.displayName
            };
            if (f.name === 'Name') {
                field.flex = 1;
            }
            var template = Rally.ui.renderer.RendererFactory.getRenderTemplate(f);
            field.renderer = function(v, m, r) {
                return template.apply(r.getData());
            }
            field.doSort = function(state) {
                var ds = this.up('rallygrid').getStore();
                var field = this.getSortParam();
                console.log('ds', ds.sorters);
                ds.sort({
                    property: field,
                    direction: state,
                    sorterFn: function(v1, v2) {
                        v1 = v1.get(field);
                        v2 = v2.get(field);
                        if (Ext.isObject(v1)) {
                            v1 = v1._refObjectName || v1.Name || v1.FormattedID || v1;
                        }
                        if (Ext.isObject(v2)) {
                            v2 = v2._refObjectName || v2.Name || v2.FormattedID || v2;
                        }
                        // transform v1 and v2 here
                        if (!v1) {
                            return -1;
                        }
                        if (!v2) {
                            return 1;
                        }
                        return v1 > v2 ? 1 : (v1 < v2 ? -1 : 0);
                    }
                });
            };

            cols.push(field);
        });

        this.logger.log('_getColumnCfgs', cols)
        return cols;
    },
    _objectSort: function(state) {

    },
    _loadPredecessors: function(records, operation) {
        this.logger.log('_loadPredecessors', records, operation);
        var predecessorFetch = this._getFetch(),
            promises = [],
            objectIDs = [];
        Ext.Array.each(records, function(r) {
            if (!Ext.Array.contains(objectIDs, r.get('ObjectID'))) {
                promises.push(r.loadPredecessors(predecessorFetch));
                objectIDs.push(r.get('ObjectID')); //this is a hack to work around the issue where multiple records are being returned from store, but not api (not sure why)
            }
        });

        if (promises.length === 0) {
            this._buildCustomGrid([]);
        }
        else {
            Deft.Promise.all(promises).then({
                success: this._buildCustomGrid,
                failure: this._showErrorNotification,
                scope: this
            });
        }

    },

    _buildCustomGrid: function(results) {
        this.logger.log('_buildCustomGrid', results);
        var data = [],
            fields = this.down('fieldpickerbutton').getFields();

        Ext.Array.each(results, function(r) {
            var predecessors = r.get('__predecessors');
            Ext.Array.each(predecessors, function(p) {
                row = r.getData();
                row.__predecessor = p;
                Ext.Array.each(fields, function(f) {
                    row['__p' + f] = p[f];
                });
                data.push(row);
            });
        });

        var storeFields = fields.concat(Ext.Array.map(fields, function(f) {
            return '__p' + f;
        })).concat(['__predecessor']);
        storeFields.unshift('_ref');
        var store = Ext.create('Rally.data.custom.Store', {
            fields: storeFields,
            data: data,
            pageSize: Math.max(data.length, 200),
            remoteSort: false
        });

        if (this.down('#grid-dependencies')) {
            this.down('#grid-dependencies').destroy();
        }

        this.down('#display_box').add({
            xtype: 'rallygrid',
            itemId: 'grid-dependencies',
            showRowActionsColumn: false,
            showPagingToolbar: false,
            store: store,
            columnCfgs: this._getColumnCfgs(),
            viewConfig: {
                stripeRows: false
            },
            autoScroll: true
        });

    },
    _showErrorNotification: function(error) {
        this.logger.log('_showErrorNotification', error);
        Rally.ui.notify.Notifier.showError({ message: error });
    },

    getOptions: function() {
        return [{
            text: 'About...',
            handler: this._launchInfo,
            scope: this
        }];
    },

    _launchInfo: function() {
        if (this.about_dialog) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink', {});
    },

    isExternal: function() {
        return typeof(this.getAppId()) == 'undefined';
    }

});
