import { useEffect, useState } from "react";
import "tailwindcss/tailwind.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchProducts,
  deleteProduct,
  getExpiringProducts,
} from "../../../services/ServicesProduct";
import { Header } from "../../../components/Header";
import SearchBar from "../../../components/SearchBar";
import { format, parseISO } from "date-fns";
import usePrecomputedExperiment from "../../../hooks/usePrecomputedExperiment";

export interface TypeProduct {
  id: number;
  name: string;
  unit_of_measure: string;
  purchase_price: string;
  sale_price: string;
  supplier: string;
  code: string;
  quantity_per_unit: number;
  expiry_date: string;
}

export interface TypeExpiringProduct {
  name: string;
  expiry_date: string;
  days_until_expiry: number;
}

const ProductsList: React.FC = () => {
  const [products, setProducts] = useState<TypeProduct[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<
    (TypeExpiringProduct & { isExpired: boolean })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDaysUntilExpiry, setModalDaysUntilExpiry] = useState<number>(0);
  const [forceUpdate, setForceUpdate] = useState(0);
  const navigate = useNavigate();

  const {
    startSession,
    registerClick,
    exportToCSV,
    getStats,
  isActive: experimentActive,
    sessionData
  } = usePrecomputedExperiment({ autoStart: true, persist: true, persistKey: "fastmart_experiment_v1" } as any);

  useEffect(() => {
    if (experimentActive) {
      const interval = setInterval(() => setForceUpdate((v) => v + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [experimentActive]);

  // Estoque baixo: ≤ 10 unidades
  const isLowStock = (quantity: number): boolean => quantity <= 10;

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchProducts();
        setProducts(data);

        if (data.length > 0) {
          // precompute targets before any highlight: choose all low-stock ids
          const low = data.filter((p) => isLowStock(p.quantity_per_unit));
          const targets = low.map((p) => `product-${p.id}`);
          // start session with precomputed targets (no UI highlight)
          if (targets.length > 0) startSession(targets, data.length);
        }
      } catch (e) {
        setError("Erro ao buscar dados da API");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [experimentActive, startSession]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleModalDaysChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setModalDaysUntilExpiry(Number(event.target.value));
  };

  const handleSearchExpiringProducts = async () => {
    if (modalDaysUntilExpiry === 0) {
      setExpiryError("Digite um número valido");
      return;
    }
    if (modalDaysUntilExpiry < 0) {
      setExpiryError("Número de dias deve ser um valor positivo.");
      return;
    }
    try {
      const data = await getExpiringProducts(modalDaysUntilExpiry);

      if (data && (data.products || data.expiredProducts)) {
        const processedProducts = [
          ...(data.products || []).map((product: TypeExpiringProduct) => {
            const expiryDate = new Date(product.expiry_date);
            const isExpired = expiryDate < new Date();
            return { ...product, isExpired };
          }),
          ...(data.expiredProducts || []).map(
            (product: TypeExpiringProduct) => ({
              ...product,
              isExpired: true,
            })
          ),
        ];

        setExpiringProducts(processedProducts);
      } else {
        setExpiringProducts([]);
      }
      setExpiryError(null);
    } catch (error) {
      setExpiryError("Erro ao buscar produtos que vão vencer");
    }
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openModal = () => setModalOpen(true);

  const closeModal = () => {
    setModalOpen(false);
    setModalDaysUntilExpiry(0);
    setExpiringProducts([]);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>{error}</p>
      </div>
    );
  }

  const handleDelete = async (code: string) => {
    await deleteProduct(code, navigate);
  };

  return (
    <div className="p-4">
      <Header showIcon={true} backRoute="/main" />
      <div className="border border-gray-300 p-10 rounded-lg shadow-md mt-5">
        <div className="flex md:flex-row flex-col items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-purple-800">
              Produtos Cadastrados
            </h1>
            {experimentActive && (
              <div className="mt-2 text-sm text-gray-600">
                 <strong>Experimento Pop-out Pré-atencional</strong> — Clique nos
                produtos com estoque baixo
                <div className="text-xs text-blue-600 mt-1">
                  Debug: {getStats().totalClicks} cliques •{" "}
                  {getStats().totalCorrect} acertos • Tentativa #
                  {getStats().completedTasks}
                </div>
                <div className="text-xs text-gray-500">
                  (Navegação para detalhes está desativada enquanto o experimento estiver ativo)
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-6">
            <SearchBar
              searchTerm={searchTerm}
              onSearchChange={handleSearchChange}
              placeholder="Pesquisar Produto"
            />

            <button
              onClick={openModal}
              className="border border-purple-900 text-purple-900 hover:text-purple-700 hover:border-purple-700 transition-colors rounded-md text-center w-52 pl-1 pr-1"
            >
              Consultar Validade
            </button>

            {experimentActive && (
              <button
                onClick={exportToCSV}
                className="border border-green-600 text-green-600 hover:text-green-700 hover:border-green-700 transition-colors rounded-md text-center w-52 pl-1 pr-1"
                title="Exportar dados do experimento"
              >
                Exportar Dados
              </button>
            )}
          </div>
        </div>

        {/* Painel de estatísticas */}
        {experimentActive && (
          <div
            className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"
            key={forceUpdate}
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="text-center">
                <div className="font-bold text-blue-700">
                  {getStats().completedTasks}
                </div>
                <div className="text-blue-600">Tentativas</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-blue-700">
                  {getStats().totalClicks}
                </div>
                <div className="text-blue-600">Cliques</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-blue-700">
                  {getStats().totalCorrect}
                </div>
                <div className="text-blue-600">Acertos</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-blue-700">
                  {getStats().avgReactionTime.toFixed(0)}ms
                </div>
                <div className="text-blue-600">Tempo Médio</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-blue-700">
                  {getStats().accuracy.toFixed(1)}%
                </div>
                <div className="text-blue-600">Precisão</div>
              </div>
            </div>
            {experimentActive && sessionData.targets.length > 0 && (
              <div className="mt-2 text-center text-blue-700 font-medium">
                Encontre o produto com estoque baixo! (alvos pré-computados: {sessionData.targets.length})
              </div>
            )}
          </div>
        )}

        {expiryError && <p className="text-red-500">{expiryError}</p>}

        {/* Tabela de produtos */}
        <div className="overflow-x-auto">
          {filteredProducts.length > 0 ? (
            <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
              <thead className="bg-purple-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-800 uppercase tracking-wider border-b">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-800 uppercase tracking-wider border-b">
                    Quantidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-800 uppercase tracking-wider border-b">
                    Unidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-800 uppercase tracking-wider border-b">
                    Preço Compra
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-800 uppercase tracking-wider border-b">
                    Preço Venda
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-800 uppercase tracking-wider border-b">
                    Fornecedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-purple-800 uppercase tracking-wider border-b">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product) => {
                  const lowStock = isLowStock(product.quantity_per_unit);
                  return (
                    <tr
                      key={product.id}
                      id={`product-${product.id}`}
                      className={`${
                            // When the experiment is active and precomputed, suppress visual pop-out highlights
                            lowStock && !experimentActive ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"
                          } transition-colors duration-200 cursor-pointer`}
                      onClick={(e) => {
                        e.preventDefault();

                      const targetId = `product-${product.id}`;
                      const isCorrect = lowStock;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const position = { x: e.clientX - rect.left, y: e.clientY - rect.top };

                      registerClick(
                        targetId,
                        isCorrect,
                        position,
                        { page: 'list', productName: product.name } 
                      );

                        // 1) registra o clique (sempre)
                        // progression through precomputed targets is handled by the experiment hook via registerClick

                        // 3) NÃO navegar enquanto o experimento está ativo
                        if (!experimentActive) {
                          setTimeout(() => {
                            navigate(`/dados-products/${product.id}`);
                          }, 100);
                        }
                      }}
                    >
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm ${
                          // avoid bold red text when experiment is active (we only want metrics)
                          lowStock && !experimentActive ? "font-bold text-red-700" : "text-gray-900"
                        }`}
                      >
                        {product.name}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm ${
                          lowStock && !experimentActive ? "font-bold text-red-700" : "text-gray-900"
                        }`}
                      >
                        {product.quantity_per_unit}
                        {lowStock && !experimentActive && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Baixo
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm ${
                          lowStock && !experimentActive ? "font-bold text-red-700" : "text-gray-900"
                        }`}
                      >
                        {product.unit_of_measure}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm ${
                          lowStock && !experimentActive ? "font-bold text-red-700" : "text-gray-900"
                        }`}
                      >
                        R$ {product.purchase_price}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm ${
                          lowStock && !experimentActive ? "font-bold text-red-700" : "text-gray-900"
                        }`}
                      >
                        R$ {product.sale_price}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm ${
                          lowStock && !experimentActive ? "font-bold text-red-700" : "text-gray-900"
                        }`}
                      >
                        {product.supplier}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-3">
                          <Link
                            to={`/editar-produto/${product.id}`}
                            className="text-neutral-500 hover:text-purple-800 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <i className="fas fa-edit"></i>
                          </Link>
                          <button
                            className="text-neutral-500 hover:text-red-600 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              const confirmed = window.confirm(
                                `Você quer mesmo deletar ${product.name}?`
                              );
                              if (confirmed) {
                                handleDelete(product.code);
                              }
                            }}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">Nenhum produto encontrado</p>
            </div>
          )}
        </div>

        {/* Modal de validade */}
        {modalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white p-6 rounded-lg shadow-lg w-[50rem] relative">
              <button
                onClick={closeModal}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
              <h2 className="text-xl font-bold text-purple-800 mb-4">
                Produtos Próximos ao Vencimento
              </h2>
              <input
                type="number"
                value={modalDaysUntilExpiry}
                onChange={handleModalDaysChange}
                placeholder="Dias até o vencimento"
                className="border border-gray-300 p-2 rounded-md mb-4 w-full"
              />
              <button
                onClick={handleSearchExpiringProducts}
                className="border border-purple-900 text-purple-900 hover:text-purple-700 hover:border-purple-700 transition-colors mb-4 w-full py-2 px-4 rounded-md"
              >
                Consultar
              </button>
              {expiryError && (
                <p className="text-red-500 mb-4">{expiryError}</p>
              )}
              <ul className="space-y-2 mb-4">
                {expiringProducts.map((product, index) => {
                  const formattedDate = format(
                    parseISO(product.expiry_date),
                    "dd/MM/yyyy"
                  );
                  return (
                    <li
                      key={index}
                      className={`flex items-center justify-between p-4 border border-gray-200 rounded-lg ${
                        product.isExpired ? "bg-red-100" : ""
                      }`}
                    >
                      <span
                        className={`${
                          product.isExpired ? "text-red-600 font-bold" : ""
                        }`}
                      >
                        {product.name} {product.isExpired && "(Vencido)"}
                      </span>
                      <div className="flex space-x-5">
                        <span>{formattedDate}</span>
                        <span>
                          {product.days_until_expiry}{" "}
                          {product.isExpired ? "dias atrás" : "dias restantes"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsList;
