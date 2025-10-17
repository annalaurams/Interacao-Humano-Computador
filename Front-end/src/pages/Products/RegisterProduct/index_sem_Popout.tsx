import React, { useEffect, useMemo, useState } from "react";
import { useFormik } from "formik";
import { toast } from "react-toastify";
import * as yup from "yup";
import { TextInput } from "../../../components/TextInput";
import { DateInput } from "../../../components/DateInput";
import { NumberInput } from "../../../components/NumberInput";
import { SelectInput } from "../../../components/SelectInput";
import { Header } from "../../../components/Header";
import { registerProduct } from "../../../services/ServicesProduct";
import NumericInput from "../../../components/NumericInput";
import { useNavigate } from "react-router-dom";
import usePrecomputedExperiment from "../../../hooks/usePrecomputedExperiment";

export const ValidationProdcutSchema = yup.object().shape({
  product: yup.object().shape({
    name: yup.string().required("Nome é obrigatório"),
    unit_of_measure: yup.string().required("Unidade de Medida é obrigatória"),
    purchase_price: yup
      .number()
      .typeError("Preço de compra deve ser um número")
      .required("Preço de compra é obrigatório"),
    sale_price: yup
      .number()
      .typeError("Preço de venda deve ser um número")
      .required("Preço de venda é obrigatório"),
    supplier: yup.string().required("Fornecedor é obrigatório"),
    code: yup.string().required("Código é obrigatório"),
  }),
  expiry_date: yup.date().required("Data de validade é obrigatória"),
});

export const RegisterProduct: React.FC = () => {
  const navigate = useNavigate();
  const [forceUpdate, setForceUpdate] = useState(0); 

  // === POP-OUT EXPERIMENTO ===
  // - alvo: campo "Quantidade por unidade" 
  const {
    startSession,
    registerClick,
    exportToCSV,
    getStats,
  isActive: experimentActive,
  sessionData,
  } = usePrecomputedExperiment({
    autoStart: true,
    persist: true,
    persistKey: "fastmart_experiment_register_v1",
  } as any);

  const FIELD_IDS = useMemo(
    () => ({
      name: "field-name",
      date: "field-date",
      unit: "field-unit",
      purchase_price: "field-purchase_price",
      quantity: "field-quantity", 
      sale_price: "field-sale_price",
      expiry_date: "field-expiry_date",
      supplier: "field-supplier",
      code: "field-code",
      payment_method: "field-payment_method",
      submit: "button-submit",
    }),
    []
  );

  // total de itens "visuais" 
  const itemCount = useMemo(() => Object.keys(FIELD_IDS).length, [FIELD_IDS]);

  useEffect(() => {
    if (experimentActive) {
      // precompute the single target (quantity field) before any UI highlight
      startSession([FIELD_IDS.quantity], itemCount);
    }
  }, [experimentActive, startSession]);

  useEffect(() => {
    if (experimentActive) {
      const t = setInterval(() => setForceUpdate((v) => v + 1), 1000);
      return () => clearInterval(t);
    }
  }, [experimentActive]);

  const handleFieldClick = (
    e: React.MouseEvent<HTMLElement>,
    fieldId: string,
    fieldLabel: string
  ) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    const isCorrect = fieldId === FIELD_IDS.quantity; // acerto = clique no alvo
    registerClick(fieldId, isCorrect, position, {
      page: "register",
      fieldName: fieldLabel,
    });
  };

  // FORMULARIO 
  const formik = useFormik({
    initialValues: {
      date: "",
      value: 1.0,
      quantity: "",
      expiry_date: "",
      payment_method: "",
      product: {
        name: "",
        unit_of_measure: "",
        purchase_price: "",
        sale_price: "",
        supplier: "",
        code: "",
      },
    },
    validationSchema: ValidationProdcutSchema,
    onSubmit: async (values) => {
   
      const date = new Date(values.expiry_date);
      const formattedDate = date.toISOString().split("T")[0];
      values.expiry_date = formattedDate;

      values.product.sale_price = values.product.sale_price.replace(/,/g, ".");
      values.product.purchase_price = values.product.purchase_price.replace(
        /,/g,
        "."
      );

      handleSyntheticSubmitClick();

      try {
        await registerProduct(values);
        toast.success("Cadastro realizado!");

        if (experimentActive) {
          toast.info(
            "Experimento ativo: exporte o CSV antes de sair (ou desative o experimento)."
          );

          return;
        }

        navigate("/main");
      } catch (err) {
        toast.error("Erro ao cadastrar produto");
      }
    },
  });

  const handleSyntheticSubmitClick = () => {

    const fakeEvent = {
      currentTarget: document.getElementById(FIELD_IDS.submit) || document.body,
      clientX: 0,
      clientY: 0,
    } as unknown as React.MouseEvent<HTMLElement>;
    handleFieldClick(fakeEvent, FIELD_IDS.submit, "Botão: Cadastrar");
  };


  const targetHighlightClass =
    "ring-2 ring-red-400 ring-offset-2 rounded-md transition-shadow";

  const isTarget = (fieldId: string) =>
    // When using precomputed sessions, the target is the quantity field.
    // Keep compatibility: if sessionData has targets, check them; otherwise default to quantity field.
    (sessionData?.targets && sessionData.targets.includes(fieldId)) || fieldId === FIELD_IDS.quantity;

  return (
    <div>
      <Header showIcon={true} backRoute="/main" />
      <div className="inset-0 flex items-center justify-center bg-gray-200 bg-opacity-50">
        <div className="mt-5 max-w-6xl mx-auto p-8 bg-white border border-gray-300 rounded-lg shadow-lg">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold text-primary">Cadastrar Produto</h2>

            {experimentActive && (
              <div
                className="ml-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700"
                key={forceUpdate}
              >
                <div className="font-semibold mb-1">🔬 Experimento Pop-out ativo</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className="text-center">
                    <div className="font-bold">{getStats().completedTasks}</div>
                    <div>Tentativas</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">{getStats().totalClicks}</div>
                    <div>Cliques</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">{getStats().totalCorrect}</div>
                    <div>Acertos</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">
                      {getStats().avgReactionTime.toFixed(0)}ms
                    </div>
                    <div>Tempo Médio</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">
                      {getStats().accuracy.toFixed(1)}%
                    </div>
                    <div>Precisão</div>
                  </div>
                </div>
                <div className="mt-2">
                  🎯 Alvo: <b>Quantidade por unidade</b> — clique nele para “acertar”.
                </div>
                <div className="mt-2">
                  <button
                    onClick={exportToCSV}
                    className="border border-green-600 text-green-600 hover:text-green-700 hover:border-green-700 transition-colors rounded-md px-3 py-1"
                    title="Exportar dados do experimento"
                  >
                    📊 Exportar CSV
                  </button>
                </div>
                <div className="mt-1 text-gray-500">
                  (A navegação automática após salvar fica desativada enquanto o experimento está ativo)
                </div>
              </div>
            )}
          </div>

          <form onSubmit={formik.handleSubmit} className="grid grid-cols-2 gap-8">
            {/* COLUNA ESQUERDA */}
            <div>
              <div
                id={FIELD_IDS.name}
                className={isTarget(FIELD_IDS.name) && !experimentActive ? targetHighlightClass : ""}
                onClick={(e) => handleFieldClick(e, FIELD_IDS.name, "Nome")}
              >
                <TextInput
                  title="Nome*"
                  placeholder="Digite o nome do produto"
                  value={formik.values.product.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  name="product.name"
                  className={
                    formik.errors.product?.name && formik.touched.product?.name
                      ? "border-red-500"
                      : ""
                  }
                />
              </div>
              {formik.errors.product?.name && formik.touched.product?.name && (
                <p className="text-red-500 text-xs -mt-3 mb-3">
                  {formik.errors.product?.name}
                </p>
              )}

              <div
                id={FIELD_IDS.date}
                className={isTarget(FIELD_IDS.date) && !experimentActive ? targetHighlightClass : ""}
                onClick={(e) => handleFieldClick(e, FIELD_IDS.date, "Data da compra")}
              >
                <DateInput
                  title="Data da compra*"
                  placeholder="Digite a data da compra"
                  value={formik.values.date}
                  onChange={formik.handleChange}
                  name="date"
                  className={
                    formik.errors.date && formik.touched.date ? "border-red-500" : ""
                  }
                />
              </div>
              {formik.errors.date && formik.touched.date && (
                <p className="text-red-500 text-xs -mt-3 mb-3">
                  {formik.errors.date}
                </p>
              )}

              <div
                id={FIELD_IDS.unit}
                className={isTarget(FIELD_IDS.unit) && !experimentActive ? targetHighlightClass : ""}
                onClick={(e) => handleFieldClick(e, FIELD_IDS.unit, "Unidade de Medida")}
              >
                <SelectInput
                  title="Unidade de Medida*"
                  value={formik.values.product.unit_of_measure}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Selecionar a unidade"
                  name="product.unit_of_measure"
                  className={
                    formik.errors.payment_method && formik.touched.payment_method
                      ? "border-red-500"
                      : ""
                  }
                  options={["kg", "g", "l", "ml", "nenhum(a)"]}
                />
              </div>
              {formik.errors.payment_method && formik.touched.payment_method && (
                <p className="text-red-500 text-xs -mt-3 mb-3">
                  {formik.errors.payment_method}
                </p>
              )}

              <div
                id={FIELD_IDS.purchase_price}
                className={
                  isTarget(FIELD_IDS.purchase_price) && !experimentActive ? targetHighlightClass : ""
                }
                onClick={(e) =>
                  handleFieldClick(e, FIELD_IDS.purchase_price, "Preço de Compra")
                }
              >
                <NumericInput
                  title="Preço de Compra*"
                  placeholder="Digite o preço de compra"
                  value={formik.values.product.purchase_price}
                  name="product.purchase_price"
                  onValueChange={(value) =>
                    formik.setFieldValue("product.purchase_price", value)
                  }
                  className={
                    formik.errors.product?.purchase_price &&
                    formik.touched.product?.purchase_price
                      ? "border-red-500"
                      : ""
                  }
                />
              </div>
              {formik.errors.product?.purchase_price &&
                formik.touched.product?.purchase_price && (
                  <p className="text-red-500 text-xs -mt-3 mb-3">
                    {formik.errors.product.purchase_price}
                  </p>
                )}

              <div
                id={FIELD_IDS.quantity}
                className={isTarget(FIELD_IDS.quantity) && !experimentActive ? targetHighlightClass : ""}
                onClick={(e) =>
                  handleFieldClick(e, FIELD_IDS.quantity, "Quantidade por unidade")
                }
              >
                <NumberInput
                  title="Quantidade por unidade*"
                  placeholder="Digite a quantidade por unidade"
                  value={formik.values.quantity}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  name="quantity"
                  className={
                    formik.errors.quantity && formik.touched.quantity
                      ? "border-red-500"
                      : ""
                  }
                />
              </div>
              {formik.errors.quantity && formik.touched.quantity && (
                <p className="text-red-500 text-xs -mt-3 mb-3">
                  {formik.errors.quantity}
                </p>
              )}
            </div>

            {/* COLUNA DIREITA */}
            <div>
              <div
                id={FIELD_IDS.sale_price}
                className={isTarget(FIELD_IDS.sale_price) && !experimentActive ? targetHighlightClass : ""}
                onClick={(e) =>
                  handleFieldClick(e, FIELD_IDS.sale_price, "Preço de Venda")
                }
              >
                <NumericInput
                  title="Preço de Venda*"
                  placeholder="Digite o preço de venda"
                  value={formik.values.product.sale_price}
                  name="product.sale_price"
                  onValueChange={(value) =>
                    formik.setFieldValue("product.sale_price", value)
                  }
                  className={
                    formik.errors.product?.sale_price &&
                    formik.touched.product?.sale_price
                      ? "border-red-500"
                      : ""
                  }
                />
              </div>
              {formik.errors.product?.sale_price &&
                formik.touched.product?.sale_price && (
                  <p className="text-red-500 text-xs -mt-3 mb-3">
                    {formik.errors.product.sale_price}
                  </p>
                )}

              <div
                id={FIELD_IDS.expiry_date}
                className={
                  isTarget(FIELD_IDS.expiry_date) && !experimentActive ? targetHighlightClass : ""
                }
                onClick={(e) =>
                  handleFieldClick(e, FIELD_IDS.expiry_date, "Data de validade")
                }
              >
                <DateInput
                  title="Data de validade*"
                  placeholder="Digite a data de validade"
                  value={formik.values.expiry_date}
                  onChange={formik.handleChange}
                  name="expiry_date"
                  className={
                    formik.errors.expiry_date && formik.touched.expiry_date
                      ? "border-red-500"
                      : ""
                  }
                />
              </div>
              {formik.errors.expiry_date && formik.touched.expiry_date && (
                <p className="text-red-500 text-xs -mt-3 mb-3">
                  {formik.errors.expiry_date}
                </p>
              )}

              <div
                id={FIELD_IDS.supplier}
                className={isTarget(FIELD_IDS.supplier) && !experimentActive ? targetHighlightClass : ""}
                onClick={(e) =>
                  handleFieldClick(e, FIELD_IDS.supplier, "Fornecedor")
                }
              >
                <TextInput
                  title="Fornecedor*"
                  placeholder="Digite o fornecedor"
                  value={formik.values.product.supplier}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  name="product.supplier"
                  className={
                    formik.errors.product?.supplier &&
                    formik.touched.product?.supplier
                      ? "border-red-500"
                      : ""
                  }
                />
              </div>
              {formik.errors.product?.supplier &&
                formik.touched.product?.supplier && (
                <p className="text-red-500 text-xs -mt-3 mb-3">
                  {formik.errors.product.supplier}
                </p>
              )}

              <div
                id={FIELD_IDS.code}
                className={isTarget(FIELD_IDS.code) && !experimentActive ? targetHighlightClass : ""}
                onClick={(e) => handleFieldClick(e, FIELD_IDS.code, "Código")}
              >
                <NumberInput
                  title="Código do Produto*"
                  placeholder="Digite o código do produto"
                  value={formik.values.product.code}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  name="product.code"
                  className={
                    formik.errors.product?.code && formik.touched.product?.code
                      ? "border-red-500"
                      : ""
                  }
                />
              </div>
              {formik.errors.product?.code && formik.touched.product?.code && (
                <p className="text-red-500 text-xs -mt-3 mb-3">
                  {formik.errors.product.code}
                </p>
              )}

              <div
                id={FIELD_IDS.payment_method}
                className={
                  isTarget(FIELD_IDS.payment_method) && !experimentActive ? targetHighlightClass : ""
                }
                onClick={(e) =>
                  handleFieldClick(e, FIELD_IDS.payment_method, "Método de Pagamento")
                }
              >
                <SelectInput
                  title="Método de Pagamento*"
                  value={formik.values.payment_method}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder="Selecionar o método de pagamento"
                  name="payment_method"
                  className={
                    formik.errors.product?.unit_of_measure &&
                    formik.touched.product?.unit_of_measure
                      ? "border-red-500"
                      : ""
                  }
                  options={[
                    "Dinheiro",
                    "Pix",
                    "Cartão de crédito",
                    "Cartão de débito",
                  ]}
                />
              </div>
              {formik.errors.product?.unit_of_measure &&
                formik.touched.product?.unit_of_measure && (
                <p className="text-red-500 text-xs -mt-3 mb-3">
                  {formik.errors.product.unit_of_measure}
                </p>
              )}
            </div>

            <button
              id={FIELD_IDS.submit}
              type="submit"
              className="col-span-2 w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-secondary transition-colors"
              onClick={(e) => handleFieldClick(e, FIELD_IDS.submit, "Botão: Cadastrar")}
              title={
                experimentActive
                  ? "Experimento ativo: o CSV pode ser exportado no topo"
                  : ""
              }
            >
              Cadastrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterProduct;
