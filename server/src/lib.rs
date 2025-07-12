use spacetimedb::{reducer, table, Identity, ReducerContext, SpacetimeType, Table};

#[table(name = user, public)]
pub struct User {
    #[primary_key]
    identity: Identity,
    name: Option<String>,
    online: bool,
}

#[table(name = layer, public)]
pub struct Layer {
    #[primary_key]
    #[auto_inc]
    id: i32,
    name: Option<String>,
    owner: Identity,
    base64: Option<String>,
    force_update: bool,
}

#[derive(SpacetimeType)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

#[derive(SpacetimeType)]
pub struct StrokeStyle {
    width: f32,
    cap: String,
    color: i32,
    alpha: f32,
}

#[derive(SpacetimeType)]
pub struct DrawCommand {
    command_type: String,
    blend_mode: Option<String>,
    pos: Option<Point>,
    stroke_style: Option<StrokeStyle>,
    start_width: Option<i32>,
    end_width: Option<i32>,
}

#[table(name = command, public)]
pub struct Command {
    #[primary_key]
    #[auto_inc]
    id: i32,
    layer: i32,
    owner: Identity,
    commands: Vec<DrawCommand>,
}

pub fn validate_name(name: String) -> Result<String, String> {
    if name.is_empty() {
        Err("Names must not be empty".to_string())
    } else {
        Ok(name)
    }
}

#[reducer]
pub fn set_name(ctx: &ReducerContext, name: String) -> Result<(), String> {
    let name = validate_name(name)?;
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(User {
            name: Some(name),
            ..user
        });
        Ok(())
    } else {
        Err("Cannot set name for unknown user".to_string())
    }
}

#[reducer]
pub fn save_layer(ctx: &ReducerContext, layer: i32, base64: String, force_update: bool) {
    if let Some(active_layer) = ctx.db.layer().id().find(layer) {
        log::info!("Updating a Layer");
        ctx.db.layer().id().update(Layer {
            owner: ctx.sender,
            base64: Some(base64),
            force_update,
            ..active_layer
        });
    } else {
        ctx.db.layer().insert(Layer {
            id: 0,
            owner: ctx.sender,
            base64: Some(base64),
            name: None,
            force_update: true,
        });
    }
}

#[reducer]
pub fn create_layer(ctx: &ReducerContext) {
    ctx.db.layer().insert(Layer {
        id: 0,
        owner: ctx.sender,
        base64: None,
        name: None,
        force_update: true,
    });
}

#[reducer]
pub fn delete_layer(ctx: &ReducerContext, layer: i32) {
    ctx.db.layer().id().delete(layer);
}

#[reducer]
pub fn rename_layer(ctx: &ReducerContext, layer: i32, name: String) -> Result<(), String> {
    if let Some(active_layer) = ctx.db.layer().id().find(layer) {
        ctx.db.layer().id().update(Layer {
            owner: ctx.sender,
            name: Some(name),
            ..active_layer
        });
        Ok(())
    } else {
        Err(format!("Rename layer event for an unknown layer with id {}", layer).to_string())
    }
}

// TODO: REDO
#[reducer]
pub fn send_command(
    ctx: &ReducerContext,
    layer: i32,
    commands: Vec<DrawCommand>,
) -> Result<(), String> {
    if ctx.db.layer().id().find(layer).is_none() {
        return Err(format!("Layer with id {} is not exist", layer).to_string());
    }

    ctx.db.command().insert(Command {
        id: 0,
        layer,
        commands,
        owner: ctx.sender,
    });
    Ok(())
}

#[reducer(client_connected)]
pub fn client_connected(ctx: &ReducerContext) {
    if let Some(user) = ctx.db.user().identity().find(ctx.sender) {
        ctx.db.user().identity().update(User {
            online: true,
            ..user
        });
    } else {
        ctx.db.user().insert(User {
            name: None,
            identity: ctx.sender,
            online: true,
        });
    }
}

#[reducer(client_disconnected)]
pub fn client_disconnected(ctx: &ReducerContext) {
    for cmd in ctx
        .db
        .command()
        .iter()
        .filter(|item| item.owner == ctx.sender)
    {
        ctx.db.command().id().delete(cmd.id);
    }
}
