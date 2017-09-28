Ext.define('Rally.technicalservices.ModelBuilder',{
    singleton: true,

    build: function(modelType, newModelName) {
        var deferred = Ext.create('Deft.Deferred');

        Rally.data.ModelFactory.getModel({
            type: modelType,
            success: function(model) {

                var default_fields = [{
                  name: '__predecessors'
                }];

                var new_model = Ext.define(newModelName, {
                    extend: model,
                    logger: new Rally.technicalservices.Logger(),
                    fields: default_fields,
                    loadPredecessors: function(predecessorFetch) {
                       //we can do stuff to the model here
                       var deferred = Ext.create('Deft.Deferred');
                       this.getCollection('Predecessors',{
                           fetch: predecessorFetch,
                           context: {project: null}
                       }).load({
                         callback: function(records, operation){
                           var predecessors = Ext.Array.map(records, function(r){ return r.getData(); });
                           this.set('__predecessors', predecessors);
                           deferred.resolve(this);
                         },
                         scope: this
                       });
                       return deferred.promise;
                     }
                });
                deferred.resolve(new_model);
            }
        });
        return deferred;
    }
});
