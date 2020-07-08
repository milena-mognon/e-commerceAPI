import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }

    const allProductsIds = products.map(product => ({
      id: product.id,
    }));

    const allProducts = await this.productsRepository.findAllById(
      allProductsIds,
    );

    if (allProducts.length < products.length) {
      throw new AppError('Some product does not exist');
    }

    products.forEach(product =>
      allProducts.forEach(dbProduct => {
        if (
          dbProduct.id === product.id &&
          dbProduct.quantity < product.quantity
        ) {
          throw new AppError(
            `the stock has only ${dbProduct.quantity} '${dbProduct.name}' available`,
          );
        }
      }),
    );

    const formatedProducts = allProducts.map(product => ({
      product_id: product.id,
      price: product.price,
      quantity: products.find(p => p.id === product.id)?.quantity ?? 0,
    }));

    await this.productsRepository.updateQuantity(products);

    const order = await this.ordersRepository.create({
      customer,
      products: formatedProducts,
    });

    return order;
  }
}

export default CreateOrderService;
