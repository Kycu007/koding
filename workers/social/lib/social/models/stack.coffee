jraphical = require 'jraphical'


module.exports = class JComputeStack extends jraphical.Module

  KodingError        = require '../error'

  { secure, ObjectId, signature, daisy } = require 'bongo'
  { Relationship }   = jraphical
  { uniq }           = require 'underscore'
  { permit }         = require './group/permissionset'
  Validators         = require './group/validators'
  { PROVIDERS }      = require './computeproviders/computeutils'


  @trait __dirname, '../traits/protected'

  @share()

  @set

    softDelete           : yes

    permissions          :

      'create stack'     : ['member']

      'update stack'     : []
      'update own stack' : ['member']

      'delete stack'     : []
      'delete own stack' : ['member']

      'list stacks'      : ['member']

    sharedMethods        :
      static             :
        create           :
          (signature Object, Function)
        some             : [
          (signature Object, Function)
          (signature Object, Object, Function)
        ]
      instance           :
        delete           :
          (signature Function)
        modify           :
          (signature Object, Function)
        checkRevision     :
          (signature Function)

    sharedEvents         :
      static             : [ ]
      instance           : [
        { name : 'updateInstance' }
      ]

    schema               :

      title              :
        type             : String
        required         : yes

      originId           :
        type             : ObjectId
        required         : yes

      group              :
        type             : String
        required         : yes

      baseStackId        : ObjectId
      stackRevision      : String

      machines           :
        type             : Object
        default          : -> []

      config             : Object

      meta               : require 'bongo/bundles/meta'

      # Identifiers of JCredentials
      # structured like following;
      #  { Provider: [JCredential.identifier ] }
      #  ---
      #  {
      #    aws: [123123, 123124]
      #    github: [234234]
      #  }
      credentials        :
        type             : Object
        default          : -> {}

      status             :

        modifiedAt       : Date
        reason           : String

        state            :
          type           : String
          default        : -> 'NotInitialized'
          enum           : ['Wrong type specified!', [
            # Unknown is a state that needs to be resolved manually
            'Unknown'

            # NotInitialzed defines a state where the stack does not exists and was
            # not built . It's waits to be initialized.
            'NotInitialized'

            # Initialized defines the state where the stack is built and in a functional state
            'Initialized'

            # Destroying is in progress of destroying the stack.
            'Destroying'

            # Building is in progress of creating the stack. A successfull building
            # state results in an Initialized state.
            'Building'
          ]]


  @getStack = (account, _id, callback) ->

    JComputeStack.one { _id, originId : account.getId() }, (err, stackObj) ->
      if err? or not stackObj?
        return callback new KodingError 'A valid stack id required'
      callback null, stackObj


  appendTo: (itemToAppend, callback) ->

    # itemToAppend is like: { machines: machine.getId() }

    # TODO add check for itemToAppend to make sure its just ~ GG
    # including supported fields: [rules, domains, machines, extras]

    @update { $addToSet: itemToAppend }, (err) -> callback err


  ###*
   * JComputeStack::create wrapper for client requests
   * @param  {Mixed}    client
   * @param  {Object}   data
   * @param  {Function} callback
   * @return {void}
  ###
  @create$ = permit 'create stack',

    success: (client, data, callback) ->

      data.account   = client.connection.delegate
      data.groupSlug = client.context.group

      delete data.baseStackId
      delete data.stackRevision

      JComputeStack.create data, callback


  ###*
   * JComputeStack::create
   * @param  {Object}   data
   * @param  {Function} callback
   * @return {void}
  ###
  @create = (data, callback) ->

    { account, groupSlug, config, credentials
      title, baseStackId, stackRevision } = data

    originId = account.getId()

    stack = new JComputeStack {
      title, config, originId, baseStackId
      stackRevision, credentials
      group: groupSlug
    }

    stack.save (err) ->
      return callback err  if err?
      callback null, stack


  @getSelector = (client, selector) ->

    { delegate } = client.connection
    { group }    = client.context

    selector ?= {}
    selector.originId = delegate.getId()
    selector.status   = { $ne: 'Terminated' }
    selector.group    = group

    return selector


  @some$ = permit 'list stacks',

    success: (client, selector, options, callback) ->

      [options, callback] = [callback, options]  unless callback
      options ?= {}

      selector = @getSelector client, selector


      JComputeStack.some selector, options, (err, _stacks) ->

        if err

          msg = 'Failed to fetch stacks'
          callback new KodingError msg
          console.warn msg, err

        else if not _stacks or _stacks.length is 0

          callback null, []

        else

          callback null, _stacks

          # stacks = []

          # queue = _stacks.map (stack) -> ->
          #   stack.revive (err, revivedStack)->
          #     stacks.push revivedStack
          #     queue.next()

          # queue.push ->
          #   callback null, stacks

          # daisy queue



  revive: (callback) ->

    JProposedDomain = require './domain'
    JMachine = require './computeproviders/machine'

    queue    = []
    domains  = []
    machines = []

    (@machines ? []).forEach (machineId) ->
      queue.push -> JMachine.one { _id: machineId }, (err, machine) ->
        if not err? and machine
          machines.push machine
        queue.next()

    (@domains ? []).forEach (domainId) ->
      queue.push -> JProposedDomain.one { _id: domainId }, (err, domain) ->
        if not err? and domain
          domains.push domain
        queue.next()

    queue.push =>
      this.machines = machines
      this.domains = domains
      callback null, this

    daisy queue


  delete: permit

    # TODO Add password check for stack delete
    #

    advanced: [
      { permission: 'delete own stack', validateWith: Validators.own }
    ]

    success: (client, callback) ->

      # TODO Implement delete methods.
      @update { $set: { status: 'Terminating' } }

      JProposedDomain  = require './domain'
      JMachine = require './computeproviders/machine'

      { delegate } = client.connection

      @domains?.forEach (_id) ->
        JProposedDomain.one { _id }, (err, domain) ->
          if not err? and domain?
            domain.remove (err) ->
              if err then console.error \
                "Failed to remove domain: #{domain.domain}", err

      @machines?.forEach (_id) ->
        JMachine.one { _id }, (err, machine) ->
          if not err? and machine?
            machine.remove (err) ->
              if err then console.error \
                "Failed to remove machine: #{machine.title}", err

      Relationship.remove {
        targetName : 'JStackTemplate'
        targetId   : @baseStackId
        sourceId   : delegate.getId()
        sourceName : 'JAccount'
        as         : 'user'
      }, (err) =>

        @remove callback


  SUPPORTED_CREDS = (Object.keys PROVIDERS).concat ['userInput', 'custom']

  modify: permit

    advanced: [
      { permission: 'update own stack', validateWith: Validators.own }
    ]

    success: (client, options, callback) ->

      { title, config, credentials } = options

      unless title or config or credentials
        return callback new KodingError 'Nothing to update'

      dataToUpdate        = {}
      dataToUpdate.title  = title   if title?
      dataToUpdate.config = config  if config?

      if credentials?
        unless typeof credentials is 'object'
          return callback new KodingError 'Credential should be an Object'

        sanitized = {}
        for key, value of credentials
          if key in SUPPORTED_CREDS
            sanitized[key] = uniq value

        dataToUpdate.credentials = sanitized

      @update { $set : dataToUpdate }, (err) ->
        return callback err  if err?
        callback null


  stackRevisionErrors =
    TEMPLATESAME      :
      message         : 'Base stack template is same'
      code            : 0
    TEMPLATEDIFFERENT :
      message         : 'Base stack template is different'
      code            : 1
    NOTFROMTEMPLATE   :
      message         : 'This stack is not created from a template'
      code            : 2
    INVALIDTEMPLATE   :
      message         : 'This stack has no revision or template is not valid.'
      code            : 3


  checkRevision: permit

    advanced: [
      { permission: 'list stacks', validateWith: Validators.own }
    ]

    success: (client, callback) ->

      if not @baseStackId
        return callback null, stackRevisionErrors.NOTFROMTEMPLATE

      JStackTemplate = require './computeproviders/stacktemplate'
      JStackTemplate.one { _id: @baseStackId }, (err, template) =>
        return callback err  if err
        return callback new KodingError 'Template not valid'  unless template

        status =
          if not template?.template?.sum or not @stackRevision
            stackRevisionErrors.INVALIDTEMPLATE
          else if template.template.sum is @stackRevision
            stackRevisionErrors.TEMPLATESAME
          else
            stackRevisionErrors.TEMPLATEDIFFERENT

        callback null, { status, machineCount: template.machines.length }
