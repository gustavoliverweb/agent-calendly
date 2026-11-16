export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admins_plataforma: {
        Row: {
          creado_en: string
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          usuario_id: string
        }
        Update: {
          creado_en?: string
          usuario_id?: string
        }
        Relationships: []
      }
      ajustes_plataforma: {
        Row: {
          actualizado_en: string
          id: boolean
          max_concurrencia_global: number
        }
        Insert: {
          actualizado_en?: string
          id?: boolean
          max_concurrencia_global?: number
        }
        Update: {
          actualizado_en?: string
          id?: boolean
          max_concurrencia_global?: number
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          accion: string
          creado_en: string
          detalle: Json | null
          empresa_id: string | null
          entidad: string
          entidad_id: string | null
          id: number
          usuario: string | null
        }
        Insert: {
          accion: string
          creado_en?: string
          detalle?: Json | null
          empresa_id?: string | null
          entidad: string
          entidad_id?: string | null
          id?: never
          usuario?: string | null
        }
        Update: {
          accion?: string
          creado_en?: string
          detalle?: Json | null
          empresa_id?: string | null
          entidad?: string
          entidad_id?: string | null
          id?: never
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      citas: {
        Row: {
          actualizado_en: string
          calendly_event_uri: string
          calendly_invitee_uri: string
          cancelada_en: string | null
          contacto_id: string
          creado_en: string
          empresa_id: string
          estado: Database["public"]["Enums"]["cita_estado"]
          id: string
          inicio: string
          llamada_id: string | null
          motivo_cancelacion: string | null
          reprogramada_desde: string | null
        }
        Insert: {
          actualizado_en?: string
          calendly_event_uri: string
          calendly_invitee_uri: string
          cancelada_en?: string | null
          contacto_id: string
          creado_en?: string
          empresa_id: string
          estado?: Database["public"]["Enums"]["cita_estado"]
          id?: string
          inicio: string
          llamada_id?: string | null
          motivo_cancelacion?: string | null
          reprogramada_desde?: string | null
        }
        Update: {
          actualizado_en?: string
          calendly_event_uri?: string
          calendly_invitee_uri?: string
          cancelada_en?: string | null
          contacto_id?: string
          creado_en?: string
          empresa_id?: string
          estado?: Database["public"]["Enums"]["cita_estado"]
          id?: string
          inicio?: string
          llamada_id?: string | null
          motivo_cancelacion?: string | null
          reprogramada_desde?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "citas_contacto_empresa_fkey"
            columns: ["empresa_id", "contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "citas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citas_llamada_empresa_fkey"
            columns: ["empresa_id", "llamada_id"]
            isOneToOne: false
            referencedRelation: "llamadas"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "citas_reprogramada_desde_fkey"
            columns: ["reprogramada_desde"]
            isOneToOne: false
            referencedRelation: "citas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          empresa_id: string
          festivos: Json
          franjas: Json
          horas_entre_reintentos: number
          max_concurrencia: number
          max_reintentos: number
          pausa_global: boolean
          retencion_transcripciones_dias: number
          retencion_webhooks_dias: number
          timeout_llamada_min: number
          tipo_campana: Database["public"]["Enums"]["tipo_campana"]
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          empresa_id: string
          festivos?: Json
          franjas?: Json
          horas_entre_reintentos?: number
          max_concurrencia?: number
          max_reintentos?: number
          pausa_global?: boolean
          retencion_transcripciones_dias?: number
          retencion_webhooks_dias?: number
          timeout_llamada_min?: number
          tipo_campana?: Database["public"]["Enums"]["tipo_campana"]
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          empresa_id?: string
          festivos?: Json
          franjas?: Json
          horas_entre_reintentos?: number
          max_concurrencia?: number
          max_reintentos?: number
          pausa_global?: boolean
          retencion_transcripciones_dias?: number
          retencion_webhooks_dias?: number
          timeout_llamada_min?: number
          tipo_campana?: Database["public"]["Enums"]["tipo_campana"]
        }
        Relationships: [
          {
            foreignKeyName: "configuracion_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contactos: {
        Row: {
          actualizado_en: string
          consentimiento: boolean
          consentimiento_fecha: string | null
          consentimiento_origen: string | null
          creado_en: string
          email: string | null
          empresa_id: string
          estado: Database["public"]["Enums"]["contacto_estado"]
          id: string
          intentos: number
          no_llamar_en: string | null
          nombre: string
          notas: string | null
          requiere_seguimiento: boolean
          seguimiento_motivo: string | null
          telefono: string
          ultimo_intento_en: string | null
        }
        Insert: {
          actualizado_en?: string
          consentimiento?: boolean
          consentimiento_fecha?: string | null
          consentimiento_origen?: string | null
          creado_en?: string
          email?: string | null
          empresa_id: string
          estado?: Database["public"]["Enums"]["contacto_estado"]
          id?: string
          intentos?: number
          no_llamar_en?: string | null
          nombre: string
          notas?: string | null
          requiere_seguimiento?: boolean
          seguimiento_motivo?: string | null
          telefono: string
          ultimo_intento_en?: string | null
        }
        Update: {
          actualizado_en?: string
          consentimiento?: boolean
          consentimiento_fecha?: string | null
          consentimiento_origen?: string | null
          creado_en?: string
          email?: string | null
          empresa_id?: string
          estado?: Database["public"]["Enums"]["contacto_estado"]
          id?: string
          intentos?: number
          no_llamar_en?: string | null
          nombre?: string
          notas?: string | null
          requiere_seguimiento?: boolean
          seguimiento_motivo?: string | null
          telefono?: string
          ultimo_intento_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contactos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          actualizado_en: string
          creado_en: string
          estado: string
          guion_activo_id: string | null
          id: string
          limite_minutos_mes: number | null
          max_concurrencia_contratada: number
          nombre: string
          phone_number_id: string | null
          slug: string
          telefono_numero: string | null
          zona_horaria: string
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          estado?: string
          guion_activo_id?: string | null
          id?: string
          limite_minutos_mes?: number | null
          max_concurrencia_contratada?: number
          nombre: string
          phone_number_id?: string | null
          slug: string
          telefono_numero?: string | null
          zona_horaria?: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          estado?: string
          guion_activo_id?: string | null
          id?: string
          limite_minutos_mes?: number | null
          max_concurrencia_contratada?: number
          nombre?: string
          phone_number_id?: string | null
          slug?: string
          telefono_numero?: string | null
          zona_horaria?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_guion_activo_fkey"
            columns: ["id", "guion_activo_id"]
            isOneToOne: false
            referencedRelation: "guiones"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
      eventos_webhook: {
        Row: {
          empresa_id: string | null
          error: string | null
          id: string
          id_externo: string
          origen: string
          payload: Json | null
          procesado_en: string | null
          recibido_en: string
          tipo: string
        }
        Insert: {
          empresa_id?: string | null
          error?: string | null
          id?: string
          id_externo: string
          origen: string
          payload?: Json | null
          procesado_en?: string | null
          recibido_en?: string
          tipo: string
        }
        Update: {
          empresa_id?: string | null
          error?: string | null
          id?: string
          id_externo?: string
          origen?: string
          payload?: Json | null
          procesado_en?: string | null
          recibido_en?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_webhook_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      guiones: {
        Row: {
          cita: string
          creado_en: string
          creado_por: string | null
          empresa_id: string
          id: string
          limites: string
          motivo: string
          negocio: string
          negocio_nombre: string
          nombre_agente: string
          objeciones: string
          oferta: string
          preguntas: string
          primer_mensaje: string
          texto: string
          version: number
          voz_id: string | null
        }
        Insert: {
          cita: string
          creado_en?: string
          creado_por?: string | null
          empresa_id: string
          id?: string
          limites?: string
          motivo: string
          negocio: string
          negocio_nombre: string
          nombre_agente: string
          objeciones?: string
          oferta: string
          preguntas?: string
          primer_mensaje: string
          texto: string
          version: number
          voz_id?: string | null
        }
        Update: {
          cita?: string
          creado_en?: string
          creado_por?: string | null
          empresa_id?: string
          id?: string
          limites?: string
          motivo?: string
          negocio?: string
          negocio_nombre?: string
          nombre_agente?: string
          objeciones?: string
          oferta?: string
          preguntas?: string
          primer_mensaje?: string
          texto?: string
          version?: number
          voz_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guiones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      integraciones_calendly: {
        Row: {
          access_token: string | null
          actualizado_en: string
          conectado_en: string
          conectado_por: string | null
          cuenta_email: string | null
          cuenta_nombre: string | null
          empresa_id: string
          estado: string
          event_type_nombre: string | null
          event_type_uri: string | null
          organizacion_uri: string | null
          refresh_token: string | null
          renovando_hasta: string | null
          token_expira_en: string | null
          ubicacion: string | null
          ubicacion_kind: string | null
          ultimo_error: string | null
          ultimo_error_en: string | null
          usuario_uri: string | null
          webhook_uri: string | null
        }
        Insert: {
          access_token?: string | null
          actualizado_en?: string
          conectado_en?: string
          conectado_por?: string | null
          cuenta_email?: string | null
          cuenta_nombre?: string | null
          empresa_id: string
          estado?: string
          event_type_nombre?: string | null
          event_type_uri?: string | null
          organizacion_uri?: string | null
          refresh_token?: string | null
          renovando_hasta?: string | null
          token_expira_en?: string | null
          ubicacion?: string | null
          ubicacion_kind?: string | null
          ultimo_error?: string | null
          ultimo_error_en?: string | null
          usuario_uri?: string | null
          webhook_uri?: string | null
        }
        Update: {
          access_token?: string | null
          actualizado_en?: string
          conectado_en?: string
          conectado_por?: string | null
          cuenta_email?: string | null
          cuenta_nombre?: string | null
          empresa_id?: string
          estado?: string
          event_type_nombre?: string | null
          event_type_uri?: string | null
          organizacion_uri?: string | null
          refresh_token?: string | null
          renovando_hasta?: string | null
          token_expira_en?: string | null
          ubicacion?: string | null
          ubicacion_kind?: string | null
          ultimo_error?: string | null
          ultimo_error_en?: string | null
          usuario_uri?: string | null
          webhook_uri?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integraciones_calendly_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      latidos: {
        Row: {
          en: string
          nombre: string
        }
        Insert: {
          en?: string
          nombre: string
        }
        Update: {
          en?: string
          nombre?: string
        }
        Relationships: []
      }
      llamadas: {
        Row: {
          actualizado_en: string
          analisis: Json | null
          calendly_cancel_url: string | null
          calendly_event_uri: string | null
          calendly_invitee_uri: string | null
          calendly_reschedule_url: string | null
          cita_agendada: boolean
          clasificacion: string | null
          contacto_id: string
          conversation_id: string | null
          creado_en: string
          duracion_seg: number | null
          empresa_id: string
          es_prueba: boolean
          estado: Database["public"]["Enums"]["llamada_estado"]
          fecha_cita: string | null
          finalizada_en: string | null
          guion_id: string | null
          id: string
          lanzada_por: string | null
          lote_id: string | null
          motivo_fallo: string | null
          resultado: string | null
          sip_call_id: string | null
          transcripcion: Json | null
          webhook_recibido_en: string | null
        }
        Insert: {
          actualizado_en?: string
          analisis?: Json | null
          calendly_cancel_url?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          calendly_reschedule_url?: string | null
          cita_agendada?: boolean
          clasificacion?: string | null
          contacto_id: string
          conversation_id?: string | null
          creado_en?: string
          duracion_seg?: number | null
          empresa_id: string
          es_prueba?: boolean
          estado?: Database["public"]["Enums"]["llamada_estado"]
          fecha_cita?: string | null
          finalizada_en?: string | null
          guion_id?: string | null
          id?: string
          lanzada_por?: string | null
          lote_id?: string | null
          motivo_fallo?: string | null
          resultado?: string | null
          sip_call_id?: string | null
          transcripcion?: Json | null
          webhook_recibido_en?: string | null
        }
        Update: {
          actualizado_en?: string
          analisis?: Json | null
          calendly_cancel_url?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          calendly_reschedule_url?: string | null
          cita_agendada?: boolean
          clasificacion?: string | null
          contacto_id?: string
          conversation_id?: string | null
          creado_en?: string
          duracion_seg?: number | null
          empresa_id?: string
          es_prueba?: boolean
          estado?: Database["public"]["Enums"]["llamada_estado"]
          fecha_cita?: string | null
          finalizada_en?: string | null
          guion_id?: string | null
          id?: string
          lanzada_por?: string | null
          lote_id?: string | null
          motivo_fallo?: string | null
          resultado?: string | null
          sip_call_id?: string | null
          transcripcion?: Json | null
          webhook_recibido_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "llamadas_contacto_empresa_fkey"
            columns: ["empresa_id", "contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "llamadas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llamadas_guion_empresa_fkey"
            columns: ["empresa_id", "guion_id"]
            isOneToOne: false
            referencedRelation: "guiones"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "llamadas_lote_empresa_fkey"
            columns: ["empresa_id", "lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
      lote_items: {
        Row: {
          actualizado_en: string
          contacto_id: string
          creado_en: string
          empresa_id: string
          estado: Database["public"]["Enums"]["lote_item_estado"]
          id: string
          intentos: number
          lote_id: string
          motivo_omision: string | null
          proximo_intento_en: string | null
          ultima_llamada_id: string | null
        }
        Insert: {
          actualizado_en?: string
          contacto_id: string
          creado_en?: string
          empresa_id: string
          estado?: Database["public"]["Enums"]["lote_item_estado"]
          id?: string
          intentos?: number
          lote_id: string
          motivo_omision?: string | null
          proximo_intento_en?: string | null
          ultima_llamada_id?: string | null
        }
        Update: {
          actualizado_en?: string
          contacto_id?: string
          creado_en?: string
          empresa_id?: string
          estado?: Database["public"]["Enums"]["lote_item_estado"]
          id?: string
          intentos?: number
          lote_id?: string
          motivo_omision?: string | null
          proximo_intento_en?: string | null
          ultima_llamada_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lote_items_contacto_empresa_fkey"
            columns: ["empresa_id", "contacto_id"]
            isOneToOne: false
            referencedRelation: "contactos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "lote_items_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_items_llamada_empresa_fkey"
            columns: ["empresa_id", "ultima_llamada_id"]
            isOneToOne: false
            referencedRelation: "llamadas"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "lote_items_lote_empresa_fkey"
            columns: ["empresa_id", "lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
      lotes: {
        Row: {
          actualizado_en: string
          creado_en: string
          creado_por: string | null
          empresa_id: string
          estado: Database["public"]["Enums"]["lote_estado"]
          id: string
          nombre: string | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          empresa_id: string
          estado?: Database["public"]["Enums"]["lote_estado"]
          id?: string
          nombre?: string | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          creado_por?: string | null
          empresa_id?: string
          estado?: Database["public"]["Enums"]["lote_estado"]
          id?: string
          nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros: {
        Row: {
          creado_en: string
          empresa_id: string
          rol: Database["public"]["Enums"]["miembro_rol"]
          usuario_id: string
        }
        Insert: {
          creado_en?: string
          empresa_id: string
          rol?: Database["public"]["Enums"]["miembro_rol"]
          usuario_id: string
        }
        Update: {
          creado_en?: string
          empresa_id?: string
          rol?: Database["public"]["Enums"]["miembro_rol"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miembros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activar_guion: { Args: { p_guion_id: string }; Returns: undefined }
      borrar_contacto_rgpd: {
        Args: { p_contacto_id: string }
        Returns: undefined
      }
      cerrar_lotes_terminados: { Args: never; Returns: number }
      comprobar_acceso_empresa: {
        Args: { p_empresa_id: string }
        Returns: undefined
      }
      concurrencia_global: {
        Args: never
        Returns: {
          activas: number
          maximo: number
        }[]
      }
      contactos_por_estado: {
        Args: { p_empresa_id: string }
        Returns: {
          estado: Database["public"]["Enums"]["contacto_estado"]
          total: number
        }[]
      }
      crear_llamada: {
        Args: {
          p_contacto_id: string
          p_guion_id?: string
          p_lanzada_por?: string
          p_lote_id?: string
          p_prueba?: boolean
        }
        Returns: string
      }
      crear_lote: {
        Args: {
          p_contacto_ids: string[]
          p_creado_por?: string
          p_empresa_id: string
          p_nombre?: string
        }
        Returns: string
      }
      empresas_con_cola: { Args: never; Returns: string[] }
      equipo_empresa: {
        Args: { p_empresa_id: string }
        Returns: {
          creado_en: string
          email: string
          pendiente: boolean
          rol: Database["public"]["Enums"]["miembro_rol"]
          ultimo_acceso: string
          usuario_id: string
        }[]
      }
      es_miembro: { Args: { p_empresa_id: string }; Returns: boolean }
      es_propietario: { Args: { p_empresa_id: string }; Returns: boolean }
      kpis_llamadas: {
        Args: { p_desde: string; p_empresa_id: string }
        Returns: {
          citas: number
          contestadas: number
          llamadas: number
          segundos: number
        }[]
      }
      llamadas_activas: { Args: { p_empresa_id: string }; Returns: number }
      llamadas_activas_global: { Args: never; Returns: number }
      marcar_no_llamar: {
        Args: { p_contacto_id: string; p_origen?: string }
        Returns: undefined
      }
      minutos_mes: { Args: { p_empresa_id: string }; Returns: number }
      purgar_datos_antiguos: { Args: never; Returns: Json }
      reclamar_renovacion_calendly: {
        Args: { p_empresa_id: string }
        Returns: boolean
      }
      reservar_llamadas_lote: {
        Args: { p_empresa_id: string; p_max?: number }
        Returns: {
          contacto_id: string
          email: string
          item_id: string
          llamada_id: string
          lote_id: string
          nombre: string
          telefono: string
        }[]
      }
      resumen_empresas: {
        Args: never
        Returns: {
          calendly: string
          contactos: number
          creado_en: string
          estado: string
          guion_activo: boolean
          id: string
          limite_minutos_mes: number
          llamadas_30d: number
          max_concurrencia_contratada: number
          miembros: number
          minutos_mes: number
          nombre: string
          phone_number_id: string
          segundos_30d: number
          slug: string
          telefono_numero: string
        }[]
      }
      usuario_por_email: { Args: { p_email: string }; Returns: string }
    }
    Enums: {
      cita_estado: "activa" | "cancelada" | "reprogramada"
      contacto_estado:
        | "pendiente"
        | "llamado"
        | "cita_agendada"
        | "no_interesado"
        | "no_contesta"
        | "no_llamar"
      llamada_estado:
        | "iniciada"
        | "en_curso"
        | "completada"
        | "fallida"
        | "buzon"
      lote_estado: "activo" | "pausado" | "completado" | "cancelado"
      lote_item_estado:
        | "en_cola"
        | "en_llamada"
        | "esperando_reintento"
        | "completado"
        | "omitido"
        | "fallido"
      miembro_rol: "propietario" | "operador"
      tipo_campana: "comercial" | "no_comercial"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cita_estado: ["activa", "cancelada", "reprogramada"],
      contacto_estado: [
        "pendiente",
        "llamado",
        "cita_agendada",
        "no_interesado",
        "no_contesta",
        "no_llamar",
      ],
      llamada_estado: [
        "iniciada",
        "en_curso",
        "completada",
        "fallida",
        "buzon",
      ],
      lote_estado: ["activo", "pausado", "completado", "cancelado"],
      lote_item_estado: [
        "en_cola",
        "en_llamada",
        "esperando_reintento",
        "completado",
        "omitido",
        "fallido",
      ],
      miembro_rol: ["propietario", "operador"],
      tipo_campana: ["comercial", "no_comercial"],
    },
  },
} as const
